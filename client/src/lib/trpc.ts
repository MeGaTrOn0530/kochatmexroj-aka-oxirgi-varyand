import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

const TOKEN_KEY = "kochat_auth_token";

function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setStoredToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}
function clearStoredToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

function resolveApiBaseUrl() {
  const configuredUrl = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");

  if (typeof window === "undefined") {
    return configuredUrl || "http://localhost:5000";
  }

  if (configuredUrl) {
    return configuredUrl;
  }

  // Proxy (dev) yoki same-origin (production) — har ikki holda /kochat ishlaydi
  return `${window.location.origin}/kochat`;
}

const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function createQueryKey(parts: string[], input?: unknown) {
  return [...parts, input ?? null];
}

function resolveApiUrl(path: string) {
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  return new URL(normalizedPath, `${API_BASE_URL}/`);
}

async function apiFetch(path: string, init?: RequestInit, query?: Record<string, unknown>) {
  const url = resolveApiUrl(path);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") {
      return;
    }

    if (value instanceof Date) {
      url.searchParams.set(key, value.toISOString().slice(0, 10));
      return;
    }

    url.searchParams.set(key, String(value));
  });

  let response: Response;

  const storedToken = getStoredToken();
  try {
    response = await fetch(url.toString(), {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
        ...(init?.headers || {}),
      },
      ...init,
    });
  } catch (error) {
    throw new ApiError(
      "Server bilan bog'lanib bo'lmadi. API manzili yoki CORS sozlamasini tekshiring.",
      0,
      {
        url: url.toString(),
        cause: error instanceof Error ? error.message : String(error),
      }
    );
  }

  const text = await response.text();
  let payload: any = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      payload?.message || response.statusText || "So'rov bajarilmadi",
      response.status,
      payload?.details ?? payload
    );
  }

  return payload?.data ?? payload;
}

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
}

function buildCode(prefix: string, label: string) {
  const core = slugify(label) || "ITEM";
  return `${prefix}-${core}-${Date.now().toString().slice(-4)}`;
}

function normalizeUser(user: any) {
  const name = user?.name || user?.fullName || user?.full_name || "-";

  return {
    id: user?.id,
    name,
    fullName: name,
    username: user?.username || "",
    email: user?.email || "",
    phone: user?.phone || "",
    role: user?.role || "agranom",
    locationId: user?.locationId ?? user?.location_id ?? null,
    locationIsSource: Boolean(user?.locationIsSource ?? user?.location_is_source),
    avatarPath: normalizeAssetUrl(user?.avatar_path || user?.avatarPath),
    status: user?.status || "active",
  };
}

function normalizeProfileUpdatePayload(payload: any) {
  return {
    user: normalizeUser(payload?.user || payload),
    requiresReauth: Boolean(payload?.requiresReauth),
  };
}

function normalizeLocation(location: any) {
  const description = location?.description || [location?.region, location?.address].filter(Boolean).join(", ");

  return {
    id: location?.id,
    name: location?.name,
    code: location?.code || "",
    type: location?.type || "greenhouse",
    capacity: location?.capacity ?? null,
    description: description || "",
    status: location?.status || "active",
    isSource: Boolean(location?.is_source ?? location?.isSource),
    totalStock: Number(location?.total_stock || location?.totalStock || 0),
    totalDefects: Number(location?.total_defects || location?.totalDefects || 0),
  };
}

function normalizeStage(stage: string | null | undefined) {
  const value = String(stage || "").toLowerCase();

  if (!value || value === "received") {
    return "cassette";
  }

  return value;
}

function normalizeAssetUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return resolveApiUrl(value).toString();
}

function parseImagePaths(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAssetUrl(String(item))).filter(Boolean) as string[];
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => normalizeAssetUrl(String(item))).filter(Boolean)
      : [];
  } catch {
    return value
      .split(",")
      .map((item) => normalizeAssetUrl(item.trim()))
      .filter(Boolean) as string[];
  }
}

function normalizeBatch(batch: any) {
  const quantityAvailable = Number(batch?.quantity_available ?? batch?.healthyQuantity ?? 0);
  const defectiveQuantity = Number(batch?.defect_quantity ?? batch?.defectiveQuantity ?? 0);
  // Teplitsa lokatsiyalari uchun faqat tayor (ready) bosqichidagi miqdorni ko'rsat
  const greenhouseReadyQty = (batch?.greenhouse_ready_qty !== undefined && batch?.greenhouse_ready_qty !== null)
    ? Number(batch.greenhouse_ready_qty)
    : null;
  const receivedAt =
    batch?.received_at_exact ||
    batch?.batch_created_at ||
    batch?.created_at ||
    batch?.received_date ||
    batch?.last_activity_at ||
    null;

  return {
    id: batch?.batch_id ?? batch?.id,
    batchId: batch?.batch_id ?? batch?.id,
    inventoryId: batch?.inventory_id ?? null,
    batchNumber: batch?.batch_code || batch?.batchNumber || `BATCH-${batch?.id}`,
    seedlingTypeId: batch?.seedling_type_id ?? batch?.seedlingTypeId ?? null,
    seedlingTypeName: batch?.seedling_type_name || batch?.seedlingTypeName || "Aniqlanmagan",
    varietyId: batch?.variety_id ?? batch?.varietyId ?? null,
    varietyName: batch?.variety_name || batch?.varietyName || "Aniqlanmagan nav",
    rootstockTypeId: batch?.rootstock_type_id ?? batch?.rootstockTypeId ?? null,
    rootstockTypeName: batch?.rootstock_type_name || batch?.rootstockTypeName || null,
    quantity: quantityAvailable + defectiveQuantity,
    quantityAvailable,
    healthyQuantity: greenhouseReadyQty !== null ? greenhouseReadyQty : quantityAvailable,
    defectiveQuantity,
    locationId: batch?.location_id ?? batch?.locationId ?? null,
    sourceLocationId: batch?.source_location_id ?? batch?.sourceLocationId ?? null,
    sourceLocationName: batch?.source_location_name || batch?.sourceLocationName || null,
    status: normalizeStage(batch?.current_stage || batch?.status || "cassette"),
    labelCodeType: batch?.label_code_type || batch?.labelCodeType || "qr",
    qrPayload: batch?.qr_payload || batch?.qrPayload || "",
    barcodeValue: batch?.barcode_value || batch?.barcodeValue || "",
    approvedBy:
      batch?.approval_status === "pending"
        ? null
        : batch?.approved_by ??
          batch?.approvedBy ??
          (batch?.approval_status === "approved" ? "system" : null),
    pendingHistoryId:
      batch?.approval_status === "pending"
        ? batch?.last_history_id ?? batch?.pending_history_id ?? null
        : null,
    lastUpdatedById: batch?.last_history_created_by ?? null,
    defectiveImages: parseImagePaths(batch?.image_paths ?? batch?.defectiveImages),
    notes: batch?.notes || "",
    receivedAt,
    receivedDate: batch?.received_date || null,
    updatedAt: batch?.last_activity_at || batch?.updated_at || receivedAt,
  };
}

function normalizeCustomerProduct(item: any) {
  return {
    id: item?.id,
    name: item?.name || "Ko'chat",
    description: item?.description || "",
    price: Number(item?.price || 0),
    imagePath: normalizeAssetUrl(item?.image_path || item?.imagePath),
    contactPhone: item?.contact_phone || item?.contactPhone || "",
    contactPhoneSecondary:
      item?.contact_phone_secondary || item?.contactPhoneSecondary || "",
    contactNote: item?.contact_note || item?.contactNote || "",
    isActive:
      item?.is_active === undefined && item?.isActive === undefined
        ? true
        : Boolean(item?.is_active ?? item?.isActive),
    displayOrder: Number(item?.display_order ?? item?.displayOrder ?? 0),
    createdAt: item?.created_at || item?.createdAt || null,
    updatedAt: item?.updated_at || item?.updatedAt || null,
  };
}

function normalizeTransfer(transfer: any) {
  // Yangi tartib: sender → receiver → head (so'nggi)
  const isRejected = transfer?.status === "rejected";
  const workflowStatus = isRejected
    ? "rejected"
    : transfer?.head_confirmed || transfer?.head_confirmed_by
      ? "completed"
      : transfer?.receiver_confirmed || transfer?.receiver_confirmed_by
        ? "pending_head"
        : transfer?.sender_confirmed || transfer?.sender_confirmed_by
          ? "pending_receiver"
          : "pending_sender";

  return {
    id: transfer?.id,
    transferCode: transfer?.transfer_code || transfer?.transferCode || null,
    batchId: transfer?.batch_id ?? transfer?.batchId,
    batchCode: transfer?.batch_code || transfer?.batchCode || null,
    seedlingTypeName: transfer?.seedling_type_name || transfer?.seedlingTypeName || "Aniqlanmagan",
    varietyName: transfer?.variety_name || transfer?.varietyName || "Aniqlanmagan nav",
    rootstockTypeName: transfer?.rootstock_type_name || transfer?.rootstockTypeName || null,
    fromLocationId: transfer?.from_location_id ?? transfer?.fromLocationId,
    fromLocationName: transfer?.from_location_name || transfer?.fromLocationName || null,
    fromLocationType: transfer?.from_location_type || transfer?.fromLocationType || null,
    toLocationId: transfer?.to_location_id ?? transfer?.toLocationId,
    toLocationName: transfer?.to_location_name || transfer?.toLocationName || null,
    toLocationType: transfer?.to_location_type || transfer?.toLocationType || null,
    quantity: Number(transfer?.quantity || 0),
    transferType: transfer?.transfer_type || transfer?.transferType || "movement",
    transferDate: transfer?.transfer_date || transfer?.created_at || new Date().toISOString(),
    createdAt: transfer?.created_at || transfer?.createdAt || null,
    createdBy: transfer?.created_by ?? transfer?.createdBy ?? null,
    createdByName: transfer?.created_by_name || transfer?.createdByName || null,
    note: transfer?.notes || transfer?.note || "",
    status: transfer?.status || workflowStatus,
    stageOnTransfer: transfer?.stage_on_transfer || transfer?.stageOnTransfer || null,
    workflowStatus,
    senderConfirmed: Boolean(transfer?.sender_confirmed || transfer?.sender_confirmed_by),
    senderConfirmedBy: transfer?.sender_confirmed_by ?? transfer?.senderConfirmedBy ?? null,
    senderConfirmedByName:
      transfer?.sender_confirmed_by_name || transfer?.senderConfirmedByName || null,
    senderConfirmedAt: transfer?.sender_confirmed_at || transfer?.senderConfirmedAt || null,
    headConfirmed: Boolean(transfer?.head_confirmed || transfer?.head_confirmed_by),
    headConfirmedBy: transfer?.head_confirmed_by ?? transfer?.headConfirmedBy ?? null,
    headConfirmedByName: transfer?.head_confirmed_by_name || transfer?.headConfirmedByName || null,
    headConfirmedAt: transfer?.head_confirmed_at || transfer?.headConfirmedAt || null,
    receiverConfirmed: Boolean(transfer?.receiver_confirmed || transfer?.receiver_confirmed_by),
    receiverConfirmedBy: transfer?.receiver_confirmed_by ?? transfer?.receiverConfirmedBy ?? null,
    receiverConfirmedByName:
      transfer?.receiver_confirmed_by_name || transfer?.receiverConfirmedByName || null,
    receiverConfirmedAt: transfer?.receiver_confirmed_at || transfer?.receiverConfirmedAt || null,
    approvedBy: transfer?.receiver_confirmed_by ?? transfer?.approvedBy ?? null,
  };
}

function normalizeOrderSummary(item: any) {
  return {
    id: item.id,
    orderNumber: item.order_number || item.orderNumber,
    customerName: item.customer_name || item.client_name || item.customerName || "-",
    customerPhone: item.customer_phone || item.customerPhone || "",
    locationId: item.location_id ?? item.locationId ?? null,
    locationName: item.location_name || "-",
    status: item.status || "new",
    totalAmount: Number(item.total_amount || 0),
    totalQuantity: Number(item.total_quantity || item.quantity || 0),
    fulfilledQuantity: Number(item.fulfilled_quantity || item.fulfilledQuantity || 0),
    shortageQuantity: Number(item.shortage_quantity || item.shortageQuantity || 0),
    expectedDate: item.expected_date || item.expectedDate || null,
    orderDate: item.order_date || item.created_at || null,
    createdAt: item.order_date || item.created_at || null,
    createdBy: item.created_by ?? item.createdBy ?? null,
    createdByName: item.created_by_name || item.createdByName || null,
    soldAt: item.sold_at || item.soldAt || null,
    soldBy: item.sold_by ?? item.soldBy ?? null,
    soldByName: item.sold_by_name || item.soldByName || null,
    batchCodes: item.batch_codes || item.batchCodes || "",
    notes: item.notes || "",
  };
}

function normalizeOrderDetail(payload: any) {
  const order = normalizeOrderSummary(payload?.order || {});

  return {
    order,
    items: (payload?.items || []).map((item: any) => ({
      id: item?.id,
      batchId: item?.batch_id ?? item?.batchId ?? null,
      batchCode: item?.batch_code || item?.batchCode || "-",
      seedlingTypeName: item?.seedling_type_name || item?.seedlingTypeName || "Aniqlanmagan",
      varietyName: item?.variety_name || item?.varietyName || "Aniqlanmagan nav",
      quantity: Number(item?.quantity || 0),
      unitPrice: Number(item?.unit_price || item?.unitPrice || 0),
      totalPrice: Number(item?.total_price || item?.totalPrice || 0),
    })),
  };
}

function normalizeActivity(item: any) {
  return {
    id: item?.id,
    action: item?.action,
    entityType: item?.entity_type || item?.entityType,
    createdAt: item?.created_at || item?.createdAt,
  };
}

function normalizeNotification(item: any) {
  return {
    id: item?.id,
    type: item?.type || "info",
    title: item?.title || "Bildirishnoma",
    message: item?.message || "",
    entityType: item?.entity_type || item?.entityType || null,
    entityId: item?.entity_id ?? item?.entityId ?? null,
    locationId: item?.location_id ?? item?.locationId ?? null,
    locationName: item?.location_name || item?.locationName || null,
    isRead: Boolean(item?.is_read ?? item?.isRead),
    createdAt: item?.created_at || item?.createdAt || null,
    readAt: item?.read_at || item?.readAt || null,
    createdByName: item?.created_by_name || item?.createdByName || null,
  };
}

function normalizeFilters(input: any = {}) {
  return {
    dateFrom: input?.startDate instanceof Date ? input.startDate : undefined,
    dateTo: input?.endDate instanceof Date ? input.endDate : undefined,
    locationId: input?.locationId,
    type: input?.locationType,
    stage: input?.stage,
    readyOnly: input?.readyOnly ? "true" : undefined,
    defectOnly: input?.defectOnly ? "true" : undefined,
    realizedOnly: input?.realizedOnly ? "true" : undefined,
  };
}

function makeQueryHook<TInput = void, TOutput = unknown>(
  parts: string[],
  fetcher: (input: TInput) => Promise<TOutput>
) {
  return {
    useQuery: (input?: TInput, options?: Omit<UseQueryOptions<TOutput, ApiError>, "queryKey" | "queryFn">) =>
      useQuery<TOutput, ApiError>({
        queryKey: createQueryKey(parts, input),
        queryFn: () => fetcher((input ?? undefined) as TInput),
        ...(options || {}),
      }),
  };
}

function makeMutationHook<TInput = void, TOutput = unknown>(
  mutator: (input: TInput) => Promise<TOutput>
) {
  return {
    useMutation: (options?: UseMutationOptions<TOutput, ApiError, TInput>) =>
      useMutation<TOutput, ApiError, TInput>({
        mutationFn: mutator,
        ...(options || {}),
      }),
  };
}

function createUtils(queryClient: ReturnType<typeof useQueryClient>) {
  const walk = (parts: string[]): any =>
    new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "invalidate") {
            return (input?: unknown) =>
              queryClient.invalidateQueries({ queryKey: createQueryKey(parts, input) });
          }

          if (prop === "setData") {
            return (input: unknown, value: unknown) =>
              queryClient.setQueryData(createQueryKey(parts, input), value);
          }

          return walk([...parts, String(prop)]);
        },
      }
    );

  return walk([]);
}

async function getBatchById(batchId: number) {
  const batches = await apiFetch("/api/seedlings");
  const found = (batches || []).find((item: any) => Number(item.batch_id ?? item.id) === Number(batchId));
  if (!found) {
    throw new ApiError("Partiya topilmadi", 404);
  }
  return found;
}

export const trpc: any = {
  useUtils: () => createUtils(useQueryClient()),
  auth: {
    me: makeQueryHook(["auth", "me"], async () => normalizeUser(await apiFetch("/api/auth/me"))),
    login: makeMutationHook(async (input: { username: string; password: string }) => {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ ...input, includeToken: true }),
      });

      if (data?.token) {
        setStoredToken(data.token);
      }

      return {
        ...data,
        user: normalizeUser(data?.user),
      };
    }),
    updateProfile: makeMutationHook(async (input: any) =>
      normalizeProfileUpdatePayload(
        await apiFetch("/api/users/me", {
          method: "PATCH",
          body: JSON.stringify({
            fullName: input?.fullName,
            username: input?.username,
            email: input?.email,
            phone: input?.phone,
            currentPassword: input?.currentPassword,
            newPassword: input?.newPassword,
            avatar: input?.avatar,
          }),
        })
      )
    ),
    logout: makeMutationHook(async () => {
      try {
        return await apiFetch("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
      } finally {
        clearStoredToken();
      }
    }),
  },
  notifications: {
    getMine: makeQueryHook(["notifications", "getMine"], async () => {
      const data = await apiFetch("/api/notifications");
      return {
        unreadCount: Number(data?.unreadCount || 0),
        items: (data?.items || []).map(normalizeNotification),
      };
    }),
    markRead: makeMutationHook(async (notificationId: number) =>
      apiFetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
        body: JSON.stringify({}),
      })
    ),
    markAllRead: makeMutationHook(async () =>
      apiFetch("/api/notifications/read-all", {
        method: "POST",
        body: JSON.stringify({}),
      })
    ),
  },
  admin: {
    getAllUsers: makeQueryHook(["admin", "getAllUsers"], async () => {
      const rows = await apiFetch("/api/users");
      return (rows || []).map(normalizeUser);
    }),
    createUser: makeMutationHook(async (input: any) => {
      const data = await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          fullName: input?.name || input?.fullName,
          username: input?.username,
          email: input?.email,
          password: input?.password,
          role: input?.role,
          locationId: input?.locationId,
        }),
      });
      return normalizeUser(data);
    }),
    updateUserAccess: makeMutationHook(async (input: any) => {
      const data = await apiFetch(`/api/users/${input.userId}`, {
        method: "PUT",
        body: JSON.stringify({
          role: input?.role,
          locationId: input?.locationId,
        }),
      });
      return normalizeUser(data);
    }),
    deactivateUser: makeMutationHook(async (input: any) =>
      apiFetch(`/api/users/${input.userId}`, { method: "DELETE" })
    ),
    createRootstockType: makeMutationHook(async (input: any) =>
      apiFetch("/api/catalog/rootstock-types", {
        method: "POST",
        body: JSON.stringify({
          name: input?.name,
          code: buildCode("ROOT", input?.name),
          description: input?.description,
        }),
      })
    ),
    updateRootstockType: makeMutationHook(async (input: any) =>
      apiFetch(`/api/catalog/rootstock-types/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: input?.name,
          description: input?.description,
        }),
      })
    ),
    deleteRootstockType: makeMutationHook(async (input: any) =>
      apiFetch(`/api/catalog/rootstock-types/${input.id}`, { method: "DELETE" })
    ),
    createSeedlingType: makeMutationHook(async (input: any) =>
      apiFetch("/api/catalog/seedling-types", {
        method: "POST",
        body: JSON.stringify({
          name: input?.name,
          code: buildCode("TYPE", input?.name),
          description: input?.description,
        }),
      })
    ),
    updateSeedlingType: makeMutationHook(async (input: any) =>
      apiFetch(`/api/catalog/seedling-types/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: input?.name,
          description: input?.description,
        }),
      })
    ),
    deleteSeedlingType: makeMutationHook(async (input: any) =>
      apiFetch(`/api/catalog/seedling-types/${input.id}`, { method: "DELETE" })
    ),
    createFruitVariety: makeMutationHook(async (input: any) =>
      apiFetch("/api/catalog/varieties", {
        method: "POST",
        body: JSON.stringify({
          seedlingTypeId: input?.seedlingTypeId,
          name: input?.name,
          code: buildCode("VAR", input?.name),
          description: input?.description,
        }),
      })
    ),
    updateFruitVariety: makeMutationHook(async (input: any) =>
      apiFetch(`/api/catalog/varieties/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          seedlingTypeId: input?.seedlingTypeId,
          name: input?.name,
          description: input?.description,
        }),
      })
    ),
    deleteFruitVariety: makeMutationHook(async (input: any) =>
      apiFetch(`/api/catalog/varieties/${input.id}`, { method: "DELETE" })
    ),
    createLocation: makeMutationHook(async (input: any) =>
      apiFetch("/api/locations", {
        method: "POST",
        body: JSON.stringify({
          name: input?.name,
          code: buildCode("LOC", input?.name),
          type: input?.type,
          capacity: input?.capacity,
          description: input?.description,
        }),
      })
    ),
    updateLocation: makeMutationHook(async (input: any) =>
      apiFetch(`/api/locations/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: input?.name,
          type: input?.type,
          capacity: input?.capacity,
          description: input?.description,
          status: input?.status,
          isSource: input?.isSource,
        }),
      })
    ),
    deleteLocation: makeMutationHook(async (input: any) =>
      apiFetch(`/api/locations/${input.id}`, { method: "DELETE" })
    ),
  },
  catalog: {
    getRootstockTypes: makeQueryHook(["catalog", "getRootstockTypes"], async () => {
      const rows = await apiFetch("/api/catalog/rootstock-types");
      return (rows || []).map((item: any) => ({
        id: item.id,
        name: item.name || `Payvand turi #${item.id}`,
        description: item.description || "",
      }));
    }),
    getSeedlingTypes: makeQueryHook(["catalog", "getSeedlingTypes"], async () => {
      const rows = await apiFetch("/api/catalog/seedling-types");
      return (rows || []).map((item: any) => ({
        id: item.id,
        name:
          item.name ||
          (String(item.code || "").startsWith("UNKNOWN") ? "Aniqlanmagan" : item.code) ||
          `Tur #${item.id}`,
        description: item.description || "",
      }));
    }),
    getFruitVarieties: makeQueryHook(["catalog", "getFruitVarieties"], async () => {
      const rows = await apiFetch("/api/catalog/varieties");
      return (rows || []).map((item: any) => ({
        id: item.id,
        seedlingTypeId: item.seedling_type_id ?? item.seedlingTypeId,
        name:
          item.name ||
          (String(item.code || "").startsWith("UNKNOWN") ? "Aniqlanmagan nav" : item.code) ||
          `Nav #${item.id}`,
        description: item.description || "",
      }));
    }),
  },
  locations: {
    getAll: makeQueryHook(["locations", "getAll"], async () => {
      const rows = await apiFetch("/api/locations");
      return (rows || []).map(normalizeLocation);
    }),
    getAllDestinations: makeQueryHook(["locations", "getAllDestinations"], async () => {
      const rows = await apiFetch("/api/locations", undefined, { all: "true" });
      return (rows || []).map(normalizeLocation);
    }),
  },
  seedlings: {
    getBatches: makeQueryHook(["seedlings", "getBatches"], async () => {
      const rows = await apiFetch("/api/seedlings");
      return (rows || []).map(normalizeBatch);
    }),
    getHistory: makeQueryHook(["seedlings", "getHistory"], async (batchId: number) => {
      const data = await apiFetch(`/api/seedlings/history/${batchId}`);
      const history = (data?.history || []).map((item: any) => ({
        id: item.id,
        fromStage: item.previous_stage ? normalizeStage(item.previous_stage) : null,
        toStage: normalizeStage(item.next_stage || "cassette"),
        quantity: Number(item.quantity || 0),
        defectiveQuantity: Number(item.defect_quantity || 0),
        imagePaths: parseImagePaths(item.image_paths),
        note: item.notes || "",
        stageDate: item.stage_date || item.created_at || new Date().toISOString(),
        approvedBy: item.approved_by || (item.approval_status === "approved" ? "system" : null),
        createdByName: item.created_by_name || null,
        approvedByName: item.approved_by_name || null,
      }));
      const totalDefects = history.reduce((sum: number, item: any) => sum + Number(item.defectiveQuantity || 0), 0);
      const latest = history[0];

      return {
        batch: {
          id: data?.batch?.id,
          batchNumber: data?.batch?.batch_code || data?.batch?.batchNumber,
          status: latest?.toStage || "cassette",
          defectiveQuantity: totalDefects,
          approvedBy: latest?.approvedBy || null,
        },
        history,
        defects: history
          .filter((item: any) => Number(item.defectiveQuantity || 0) > 0)
          .map((item: any) => ({
            id: item.id,
            quantity: item.defectiveQuantity,
            description: item.note || "",
            imagePaths: item.imagePaths || [],
            createdAt: item.stageDate,
          })),
      };
    }),
    createBatch: makeMutationHook(async (input: any) => {
      return apiFetch("/api/seedlings/receive", {
        method: "POST",
        body: JSON.stringify({
          seedlingTypeId: input.seedlingTypeId || undefined,
          varietyId: input.varietyId || undefined,
          rootstockTypeId: input.rootstockTypeId || undefined,
          locationId: input.locationId,
          quantity: input.quantity,
          receivedAt:
            input.receivedAt instanceof Date
              ? input.receivedAt.toISOString()
              : input.receivedAt || undefined,
          receivedDate:
            input.receivedDate instanceof Date
              ? input.receivedDate.toISOString().slice(0, 10)
              : undefined,
          batchCode: input.batchNumber,
          labelCodeType: input.labelCodeType || "qr",
          notes: input.notes,
          requiresApproval: input.requiresApproval ?? true,
        }),
      });
    }),
    updateBatchStatus: makeMutationHook(async (input: any) => {
      const batch = await getBatchById(Number(input.batchId));
      return apiFetch("/api/seedlings/stage-change", {
        method: "POST",
        body: JSON.stringify({
          batchId: input.batchId,
          locationId: batch.location_id ?? batch.locationId,
          nextStage: input.status,
          fromStage: input.fromStage || undefined,
          defectQuantityChange: Number(input.defectiveQuantity || 0),
          failedGraftQuantity: Number(input.failedGraftQuantity || 0),
          defectiveImages: Array.isArray(input.defectiveImages) ? input.defectiveImages : [],
          stageDate:
            input.stageDate instanceof Date ? input.stageDate.toISOString() : input.stageDate,
          notes: input.note,
          requiresApproval: input.requiresApproval ?? true,
        }),
      });
    }),
    deleteBatch: makeMutationHook(async (batchId: number) =>
      apiFetch(`/api/seedlings/batches/${batchId}`, { method: "DELETE" })
    ),
    getWriteOffs: makeQueryHook(["seedlings", "getWriteOffs"], async () => {
      const rows = await apiFetch("/api/seedlings/write-offs");
      return (rows || []).map((item: any) => ({
        id: item.id,
        batchId: item.batch_id,
        batchCode: item.batch_code,
        varietyName: item.variety_name || "—",
        quantity: Number(item.quantity || 0),
        note: item.notes || "",
        date: item.stage_date || item.created_at,
        createdByName: item.created_by_name,
      }));
    }),
    writeOff: makeMutationHook(async (input: { inventoryId: number; quantity: number; note?: string }) =>
      apiFetch("/api/seedlings/write-off", {
        method: "POST",
        body: JSON.stringify({
          inventoryId: input.inventoryId,
          quantity: input.quantity,
          note: input.note || undefined,
        }),
      })
    ),
    editBatch: makeMutationHook(async (input: any) =>
      apiFetch(`/api/seedlings/batches/${input.batchId}`, {
        method: "PATCH",
        body: JSON.stringify({
          seedlingTypeId: input.seedlingTypeId,
          varietyId: input.varietyId,
          rootstockTypeId: input.rootstockTypeId,
          notes: input.notes,
          batchCode: input.batchCode,
        }),
      })
    ),
    getGreenhouseSummary: makeQueryHook(["seedlings", "getGreenhouseSummary"], async (locationType?: string) => {
      const rows = await apiFetch("/api/seedlings/greenhouse-summary", undefined, locationType ? { locationType } : {});
      return (rows || []).map((row: any) => ({
        locationId: row.location_id,
        locationName: row.location_name,
        locationType: row.location_type,
        stage: row.current_stage,
        batchCount: Number(row.batch_count || 0),
        totalQuantity: Number(row.total_quantity || 0),
        totalDefects: Number(row.total_defects || 0),
      }));
    }),
    approveBatch: makeMutationHook(async (historyId: number) => {
      return apiFetch(`/api/seedlings/${historyId}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    }),
    getUnits: makeQueryHook(["seedlings", "getUnits"], async (batchId: number) => {
      const data = await apiFetch(`/api/seedlings/units/${batchId}`);
      return {
        batch: {
          id: data?.batch?.id,
          batchCode: data?.batch?.batch_code || data?.batch?.batchCode,
          initialQuantity: Number(data?.batch?.initial_quantity || 0),
          quantityAvailable: Number(data?.batch?.quantity_available || 0),
          defectQuantity: Number(data?.batch?.defect_quantity || 0),
          currentStage: data?.batch?.current_stage || "cassette",
          locationName: data?.batch?.location_name || "",
          seedlingTypeName: data?.batch?.seedling_type_name || "",
          varietyName: data?.batch?.variety_name || "",
          receivedDate: data?.batch?.received_date || null,
          createdAt: data?.batch?.created_at || null,
        },
        units: (data?.units || []).map((u: any) => ({
          id: u.id,
          unitNumber: Number(u.unit_number),
          unitCode: u.unit_code,
          qrPayload: u.qr_payload || "",
          currentStage: u.current_stage || "cassette",
          isDefective: Boolean(u.is_defective),
          notes: u.notes || "",
        })),
      };
    }),
  },
  transfers: {
    getAll: makeQueryHook(["transfers", "getAll"], async () => {
      const rows = await apiFetch("/api/transfers");
      return (rows || []).map(normalizeTransfer);
    }),
    createTransfer: makeMutationHook(async (input: any) =>
      apiFetch("/api/transfers", {
        method: "POST",
        body: JSON.stringify({
          batchId: input.batchId,
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          quantity: input.quantity,
          transferType: input.transferType,
          notes: input.note,
        }),
      })
    ),
    confirmSender: makeMutationHook(async (transferId: number) =>
      apiFetch(`/api/transfers/${transferId}/sender-confirm`, {
        method: "POST",
        body: JSON.stringify({}),
      })
    ),
    confirmHead: makeMutationHook(async (transferId: number) =>
      apiFetch(`/api/transfers/${transferId}/head-confirm`, {
        method: "POST",
        body: JSON.stringify({}),
      })
    ),
    confirmReceiver: makeMutationHook(async (transferId: number) =>
      apiFetch(`/api/transfers/${transferId}/receiver-confirm`, {
        method: "POST",
        body: JSON.stringify({}),
      })
    ),
    rejectTransfer: makeMutationHook(async (input: { transferId: number; reason?: string }) =>
      apiFetch(`/api/transfers/${input.transferId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: input.reason }),
      })
    ),
  },
  orders: {
    getAll: makeQueryHook(["orders", "getAll"], async () => {
      const rows = await apiFetch("/api/orders");
      return (rows || []).map(normalizeOrderSummary);
    }),
    getReservationStats: makeQueryHook(["orders", "getReservationStats"], async () => {
      const rows = await apiFetch("/api/orders");
      const active = (rows || []).filter(
        (o: any) => o.status !== "completed" && o.status !== "cancelled"
      );
      const totalReserved = active.reduce(
        (sum: number, o: any) => sum + Number(o.total_quantity || o.quantity || 0),
        0
      );
      const fulfilled = active.reduce(
        (sum: number, o: any) => sum + Number(o.fulfilled_quantity || 0),
        0
      );
      const shortage = active.reduce(
        (sum: number, o: any) => sum + Number(o.shortage_quantity || 0),
        0
      );
      return {
        totalReserved,
        fulfilled,
        shortage,
        activeOrderCount: active.length,
      };
    }),
    getDetail: makeMutationHook(async (orderId: number) =>
      normalizeOrderDetail(await apiFetch(`/api/orders/${orderId}`))
    ),
    createGreenhouseOrder: makeMutationHook(async (input: {
      locationId: number;
      customerName: string;
      customerPhone?: string;
      varietyId?: number;
      seedlingTypeId?: number;
      rootstockTypeId?: number;
      quantity: number;
      unitPrice?: number;
      notes?: string;
      orderDate?: string;
      expectedDate?: string;
      orderNumber?: string;
    }) =>
      apiFetch("/api/orders/greenhouse", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ),
    createOrder: makeMutationHook(async (input: any) => {
      const batch = input.locationId ? { location_id: input.locationId } : await getBatchById(Number(input.batchId));

      return apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          orderNumber: input.orderNumber,
          customerName: input.customerName || input.orderNumber || "Mijoz",
          customerPhone: input.customerPhone || undefined,
          notes: input.notes || undefined,
          orderDate:
            input.orderDate instanceof Date ? input.orderDate.toISOString() : input.orderDate,
          locationId: batch.location_id ?? batch.locationId,
          items: [
            {
              batchId: input.batchId,
              quantity: input.quantity,
              unitPrice: Number(input.unitPrice || 0),
            },
          ],
        }),
      });
    }),
    agranomConfirm: makeMutationHook(async (orderId: number) =>
      apiFetch(`/api/orders/${orderId}/agranom-confirm`, {
        method: "POST",
        body: JSON.stringify({}),
      })
    ),
    sellOrder: makeMutationHook(async (input: { orderId: number; notes?: string }) =>
      apiFetch(`/api/orders/${input.orderId}/sell`, {
        method: "POST",
        body: JSON.stringify({ notes: input.notes || undefined }),
      })
    ),
    partialFulfill: makeMutationHook(
      async (input: { orderId: number; deliverQuantity: number; notes?: string }) =>
        apiFetch(`/api/orders/${input.orderId}/partial-fulfill`, {
          method: "POST",
          body: JSON.stringify({
            deliverQuantity: input.deliverQuantity,
            notes: input.notes || undefined,
          }),
        })
    ),
    deleteOrder: makeMutationHook(async (orderId: number) =>
      apiFetch(`/api/orders/${orderId}`, { method: "DELETE" })
    ),
    getOrdersSummary: makeQueryHook(
      ["orders", "getOrdersSummary"],
      async (filters?: { dateFrom?: string; dateTo?: string }) => {
        const params = new URLSearchParams();
        if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters?.dateTo) params.set("dateTo", filters.dateTo);
        const qs = params.toString();
        return apiFetch(`/api/reports/orders-summary${qs ? `?${qs}` : ""}`);
      }
    ),
  },
  financial: {
    getReport: makeQueryHook(
      ["financial", "getReport"],
      async (filters?: { dateFrom?: string; dateTo?: string }) => {
        const params = new URLSearchParams();
        if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters?.dateTo) params.set("dateTo", filters.dateTo);
        const qs = params.toString();
        return apiFetch(`/api/reports/financial${qs ? `?${qs}` : ""}`);
      }
    ),
  },
  movements: {
    getFull: makeQueryHook(
      ["movements", "getFull"],
      async (filters?: { dateFrom?: string; dateTo?: string; locationId?: number; movementType?: string }) => {
        const params = new URLSearchParams();
        if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters?.dateTo) params.set("dateTo", filters.dateTo);
        if (filters?.locationId) params.set("locationId", String(filters.locationId));
        if (filters?.movementType) params.set("movementType", filters.movementType);
        const qs = params.toString();
        const rows = await apiFetch(`/api/reports/movements-full${qs ? `?${qs}` : ""}`);
        return rows || [];
      }
    ),
  },
  adminReset: {
    resetData: makeMutationHook(
      async (opts: { keepUsers?: boolean; keepLocations?: boolean; keepCatalog?: boolean } = {}) =>
        apiFetch("/api/reset/data", { method: "POST", body: JSON.stringify(opts) })
    ),
  },
  greenhouse: {
    getSummary: makeQueryHook(["greenhouse", "getSummary"], async () => {
      const rows = await apiFetch("/api/greenhouse/summary");
      return (rows || []).map((row: any) => ({
        locationId: row.locationId,
        locationName: row.locationName,
        locationType: row.locationType,
        cassette: Number(row.cassette || 0),
        grafting: Number(row.grafting || 0),
        grafted: Number(row.grafted || 0),
        ready: Number(row.ready || 0),
        total: Number(row.total || 0),
        defectTotal: Number(row.defectTotal || 0),
      }));
    }),
    getOne: makeQueryHook(["greenhouse", "getOne"], async (locationId: number) => {
      const data = await apiFetch(`/api/greenhouse/${locationId}`);
      return {
        location: data?.location,
        stock: {
          cassette: Number(data?.stock?.cassette || 0),
          grafting: Number(data?.stock?.grafting || 0),
          grafted: Number(data?.stock?.grafted || 0),
          ready: Number(data?.stock?.ready || 0),
          total: Number(data?.stock?.total || 0),
        },
      };
    }),
    getVarietyStock: makeQueryHook(["greenhouse", "getVarietyStock"], async (locationId: number) => {
      const rows = await apiFetch(`/api/greenhouse/${locationId}/variety-stock`);
      return (rows || []).map((row: any) => ({
        stage: row.stage as string,
        varietyId: Number(row.variety_id || 0),
        seedlingTypeId: Number(row.seedling_type_id || 0),
        rootstockTypeId: Number(row.rootstock_type_id || 0),
        quantity: Number(row.quantity || 0),
        varietyName: row.variety_name || null,
        seedlingTypeName: row.seedling_type_name || null,
        rootstockTypeName: row.rootstock_type_name || null,
      }));
    }),
    getLog: makeQueryHook(["greenhouse", "getLog"], async (locationId: number) => {
      const rows = await apiFetch(`/api/greenhouse/${locationId}/log`);
      return (rows || []).map((row: any) => ({
        id: row.id,
        actionDate: row.action_date,
        fromStage: row.from_stage || null,
        toStage: row.to_stage,
        quantity: Number(row.quantity || 0),
        notes: row.notes || "",
        seedlingTypeName: row.seedling_type_name || null,
        varietyName: row.variety_name || null,
        rootstockTypeName: row.rootstock_type_name || null,
        imagePaths: (() => {
          try { return JSON.parse(row.image_paths || "[]"); } catch { return []; }
        })(),
        createdByName: row.created_by_name || null,
        createdAt: row.created_at,
      }));
    }),
    receive: makeMutationHook(async (input: { locationId: number; quantity: number; notes?: string; transferId?: number }) =>
      apiFetch(`/api/greenhouse/${input.locationId}/receive`, {
        method: "POST",
        body: JSON.stringify({
          quantity: input.quantity,
          notes: input.notes,
          transferId: input.transferId,
        }),
      })
    ),
    move: makeMutationHook(async (input: {
      locationId: number;
      fromStage: string;
      toStage: string;
      quantity: number;
      failedQuantity?: number;
      defectQuantity?: number;
      defectNotes?: string;
      actionDate?: string;
      notes?: string;
      images?: any[];
      defectImages?: any[];
      seedlingTypeId?: number;
      varietyId?: number;
      rootstockTypeId?: number;
      fromRootstockTypeId?: number;
    }) =>
      apiFetch(`/api/greenhouse/${input.locationId}/move`, {
        method: "POST",
        body: JSON.stringify({
          fromStage: input.fromStage,
          toStage: input.toStage,
          quantity: input.quantity,
          failedQuantity: input.failedQuantity || 0,
          defectQuantity: input.defectQuantity || 0,
          defectNotes: input.defectNotes || undefined,
          actionDate: input.actionDate,
          notes: input.notes,
          images: input.images || [],
          defectImages: input.defectImages || [],
          seedlingTypeId: input.seedlingTypeId || undefined,
          varietyId: input.varietyId || undefined,
          rootstockTypeId: input.rootstockTypeId || undefined,
          fromRootstockTypeId: input.fromRootstockTypeId || undefined,
        }),
      })
    ),
    getDefectLog: makeQueryHook(["greenhouse", "getDefectLog"], async (locationId: number) => {
      const rows = await apiFetch(`/api/greenhouse/${locationId}/defect-log`);
      return (rows || []).map((row: any) => ({
        id: row.id,
        actionDate: row.action_date,
        fromStage: row.from_stage || null,
        quantity: Number(row.quantity || 0),
        notes: row.notes || "",
        varietyName: row.variety_name || null,
        seedlingTypeName: row.seedling_type_name || null,
        rootstockTypeName: row.rootstock_type_name || null,
        imagePaths: (() => {
          try { return JSON.parse(row.image_paths || "[]"); } catch { return []; }
        })(),
        createdByName: row.created_by_name || null,
      }));
    }),
    deleteLog: makeMutationHook(async (input: { locationId: number; logId: number }) =>
      apiFetch(`/api/greenhouse/${input.locationId}/log/${input.logId}`, { method: "DELETE" })
    ),
    stageTransfer: makeMutationHook(async (input: {
      locationId: number;
      toLocationId: number;
      fromStage: string;
      toStage?: string;
      quantity: number;
      fromRootstockTypeId?: number;
      notes?: string;
      actionDate?: string;
    }) =>
      apiFetch(`/api/greenhouse/${input.locationId}/stage-transfer`, {
        method: "POST",
        body: JSON.stringify({
          toLocationId: input.toLocationId,
          fromStage: input.fromStage,
          toStage: input.toStage,
          quantity: input.quantity,
          fromRootstockTypeId: input.fromRootstockTypeId,
          notes: input.notes,
          actionDate: input.actionDate,
        }),
      })
    ),
    getGreenhouseTransfers: makeQueryHook(["greenhouse", "transfers"], async () => {
      const rows = await apiFetch("/api/greenhouse/transfers");
      return (rows || []).map((r: any) => ({
        id: r.id,
        transferCode: r.transfer_code,
        fromLocationId: r.from_location_id,
        toLocationId: r.to_location_id,
        fromLocationName: r.from_location_name,
        toLocationName: r.to_location_name,
        fromStage: r.from_stage,
        toStage: r.to_stage,
        quantity: r.quantity,
        rootstockTypeName: r.rootstock_type_name,
        transferDate: r.transfer_date,
        note: r.note,
        status: r.status,
        createdByName: r.created_by_name,
        senderConfirmedBy: r.sender_confirmed_by,
        senderConfirmedByName: r.sender_confirmed_by_name,
        headConfirmedBy: r.head_confirmed_by,
        headConfirmedByName: r.head_confirmed_by_name,
        receiverConfirmedBy: r.receiver_confirmed_by,
        receiverConfirmedByName: r.receiver_confirmed_by_name,
        createdAt: r.created_at,
      }));
    }),
    confirmGHTransferHead: makeMutationHook(async (id: number) =>
      apiFetch(`/api/greenhouse/transfers/${id}/confirm-head`, { method: "POST" })
    ),
    confirmGHTransferReceiver: makeMutationHook(async (id: number) =>
      apiFetch(`/api/greenhouse/transfers/${id}/confirm-receiver`, { method: "POST" })
    ),
  },
  tasks: {
    getAll: makeQueryHook(["tasks", "getAll"], async (filters?: { status?: string; assignedTo?: number }) => {
      const rows = await apiFetch("/api/tasks", undefined, {
        status: filters?.status,
        assignedTo: filters?.assignedTo,
      });
      return (rows || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description || "",
        locationId: t.location_id ?? null,
        locationName: t.location_name || null,
        assignedTo: t.assigned_to ?? null,
        assignedToName: t.assigned_to_name || null,
        createdBy: t.created_by ?? null,
        createdByName: t.created_by_name || null,
        status: t.status || "open",
        priority: t.priority || "medium",
        dueDate: t.due_date || null,
        completedAt: t.completed_at || null,
        createdAt: t.created_at || null,
      }));
    }),
    create: makeMutationHook(async (input: any) =>
      apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          description: input.description,
          locationId: input.locationId,
          assignedTo: input.assignedTo,
          priority: input.priority || "medium",
          status: input.status || "open",
          dueDate: input.dueDate,
        }),
      })
    ),
    update: makeMutationHook(async (input: any) =>
      apiFetch(`/api/tasks/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: input.title,
          description: input.description,
          locationId: input.locationId,
          assignedTo: input.assignedTo,
          priority: input.priority,
          status: input.status,
          dueDate: input.dueDate,
        }),
      })
    ),
  },
  // ── YANGI MODULLAR ──────────────────────────────
  payments: {
    getAll: makeQueryHook(["payments", "getAll"], () => apiFetch("/api/modules/payments")),
    getByOrder: makeQueryHook(["payments", "byOrder"], (orderId: number) => apiFetch(`/api/modules/payments/by-order/${orderId}`)),
    add: makeMutationHook((input: any) => apiFetch("/api/modules/payments", { method: "POST", body: JSON.stringify(input) })),
    remove: makeMutationHook((id: number) => apiFetch(`/api/modules/payments/${id}`, { method: "DELETE" })),
  },
  customers: {
    getAll: makeQueryHook(["customers", "getAll"], (search?: string) =>
      apiFetch(`/api/modules/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`)),
    add: makeMutationHook((input: any) => apiFetch("/api/modules/customers", { method: "POST", body: JSON.stringify(input) })),
    update: makeMutationHook((input: any) => apiFetch(`/api/modules/customers/${input.id}`, { method: "PUT", body: JSON.stringify(input) })),
    remove: makeMutationHook((id: number) => apiFetch(`/api/modules/customers/${id}`, { method: "DELETE" })),
  },
  deliveries: {
    getAll: makeQueryHook(["deliveries", "getAll"], (status?: string) =>
      apiFetch(`/api/modules/deliveries${status ? `?status=${status}` : ""}`)),
    add: makeMutationHook((input: any) => apiFetch("/api/modules/deliveries", { method: "POST", body: JSON.stringify(input) })),
    updateStatus: makeMutationHook((input: { id: number; status: string }) =>
      apiFetch(`/api/modules/deliveries/${input.id}/status`, { method: "PUT", body: JSON.stringify({ status: input.status }) })),
    remove: makeMutationHook((id: number) => apiFetch(`/api/modules/deliveries/${id}`, { method: "DELETE" })),
  },
  agroJournal: {
    getAll: makeQueryHook(["agroJournal", "getAll"], (filters?: any) => {
      const params = new URLSearchParams();
      if (filters?.locationId) params.set("locationId", filters.locationId);
      if (filters?.actionType) params.set("actionType", filters.actionType);
      if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters?.dateTo) params.set("dateTo", filters.dateTo);
      const qs = params.toString();
      return apiFetch(`/api/modules/agro-journal${qs ? `?${qs}` : ""}`);
    }),
    add: makeMutationHook((input: any) => apiFetch("/api/modules/agro-journal", { method: "POST", body: JSON.stringify(input) })),
    remove: makeMutationHook((id: number) => apiFetch(`/api/modules/agro-journal/${id}`, { method: "DELETE" })),
  },
  hr: {
    getAttendance: makeQueryHook(["hr", "getAttendance"], (date?: string) =>
      apiFetch(`/api/modules/attendance${date ? `?date=${date}` : ""}`)),
    saveAttendance: makeMutationHook((input: any) => apiFetch("/api/modules/attendance", { method: "POST", body: JSON.stringify(input) })),
    getTasks: makeQueryHook(["hr", "getTasks"], () => apiFetch("/api/modules/tasks")),
    addTask: makeMutationHook((input: any) => apiFetch("/api/modules/tasks", { method: "POST", body: JSON.stringify(input) })),
    updateTaskStatus: makeMutationHook((input: { id: number; status: string }) =>
      apiFetch(`/api/modules/tasks/${input.id}/status`, { method: "PUT", body: JSON.stringify({ status: input.status }) })),
    removeTask: makeMutationHook((id: number) => apiFetch(`/api/modules/tasks/${id}`, { method: "DELETE" })),
  },
  telegram: {
    getSettings: makeQueryHook(["telegram", "getSettings"], () => apiFetch("/api/modules/telegram/settings")),
    saveSettings: makeMutationHook((input: any) => apiFetch("/api/modules/telegram/settings", { method: "POST", body: JSON.stringify(input) })),
    getBotConfig: makeQueryHook(["telegram", "getBotConfig"], () => apiFetch("/api/modules/telegram/bot-config")),
    saveBotConfig: makeMutationHook((input: any) => apiFetch("/api/modules/telegram/bot-config", { method: "POST", body: JSON.stringify(input) })),
    getPublicConfig: makeQueryHook(["telegram", "getPublicConfig"], () => apiFetch("/api/customer-products/public-config")),
    getBotOrders: makeQueryHook(["telegram", "getBotOrders"], () => apiFetch("/api/modules/telegram/bot-orders")),
    updateBotOrderStatus: makeMutationHook((input: { id: number; status: string }) =>
      apiFetch(`/api/modules/telegram/bot-orders/${input.id}/status`, { method: "PUT", body: JSON.stringify({ status: input.status }) })),
  },
  boshOfes: {
    getModules: makeQueryHook(["boshOfes", "getModules"], () => apiFetch("/api/modules/bosh-ofes/modules")),
    saveModules: makeMutationHook((input: Record<string, boolean>) =>
      apiFetch("/api/modules/bosh-ofes/modules", { method: "POST", body: JSON.stringify(input) })),
  },
  certificates: {
    getAll: makeQueryHook(["certificates", "getAll"], () => apiFetch("/api/modules/certificates")),
    add: makeMutationHook((input: any) => apiFetch("/api/modules/certificates", { method: "POST", body: JSON.stringify(input) })),
    updateStatus: makeMutationHook((input: { id: number; status: string }) =>
      apiFetch(`/api/modules/certificates/${input.id}/status`, { method: "PUT", body: JSON.stringify({ status: input.status }) })),
  },
  // ────────────────────────────────────────────
  dashboard: {
    getStats: makeQueryHook(["dashboard", "getStats"], async () => {
      const data = await apiFetch("/api/dashboard/stats");
      const summary = data?.summary || {};
      const report = await apiFetch("/api/reports/general");

      // Per-location greenhouse stage stock
      const rawLocStock: any[] = data?.locationStageStock || [];
      const rawSrcInv: any[] = data?.sourceInventory || [];

      // Group greenhouse stage stock by location (skip source/padvo locations)
      const locMap: Record<number, { locationId: number; locationName: string; isSource: boolean; stages: Record<string, number> }> = {};
      for (const row of rawLocStock) {
        if (row.is_source) continue;
        const lid = Number(row.location_id);
        if (!locMap[lid]) {
          locMap[lid] = { locationId: lid, locationName: row.location_name, isSource: false, stages: {} };
        }
        if (row.stage) locMap[lid].stages[row.stage] = Number(row.quantity || 0);
      }
      const locationStageStock = Object.values(locMap);

      // Group source/padvo inventory by location as per-batch list
      const srcLocMap: Record<number, { locationId: number; locationName: string; batches: Array<{ batchId: number; batchCode: string; varietyName: string; seedlingTypeName: string; stage: string; quantity: number }> }> = {};
      for (const row of rawSrcInv) {
        const lid = Number(row.location_id);
        if (!srcLocMap[lid]) {
          srcLocMap[lid] = { locationId: lid, locationName: row.location_name, batches: [] };
        }
        srcLocMap[lid].batches.push({
          batchId: Number(row.batch_id),
          batchCode: row.batch_code || "",
          varietyName: row.variety_name || "",
          seedlingTypeName: row.seedling_type_name || "",
          stage: row.stage || "",
          quantity: Number(row.quantity || 0),
        });
      }
      const sourceLocationInventory = Object.values(srcLocMap);

      return {
        totalBatches: Number(report?.summary?.batches_count || 0),
        totalLocations: Number(report?.summary?.locations_count || 0),
        totalTransfers: Number(report?.summary?.transfers_count || 0),
        greenhouseReady: Number(summary.greenhouse_ready || 0),
        greenhouseGrafted: Number(summary.greenhouse_grafted || 0),
        greenhouseGrafting: Number(summary.greenhouse_grafting || 0),
        greenhouseCassette: Number(summary.greenhouse_cassette || 0),
        greenhouseTotal: Number(summary.greenhouse_total || 0),
        pendingTransfers: Number(summary.pending_transfers || 0),
        pendingApprovals: Number(summary.pending_approvals || 0),
        openTasks: Number(summary.open_tasks || 0),
        locationStageStock,
        sourceLocationInventory,
      };
    }),
    getActivityLog: makeQueryHook(["dashboard", "getActivityLog"], async () => {
      const rows = await apiFetch("/api/dashboard/activity-log");
      return (rows || []).map(normalizeActivity);
    }),
  },
  customerProducts: {
    getPublic: makeQueryHook(["customerProducts", "getPublic"], async () => {
      const rows = await apiFetch("/api/customer-products/public");
      return (rows || []).map(normalizeCustomerProduct);
    }),
    getAll: makeQueryHook(["customerProducts", "getAll"], async () => {
      const rows = await apiFetch("/api/customer-products");
      return (rows || []).map(normalizeCustomerProduct);
    }),
    create: makeMutationHook(async (input: any) =>
      normalizeCustomerProduct(
        await apiFetch("/api/customer-products", {
          method: "POST",
          body: JSON.stringify({
            name: input?.name,
            description: input?.description,
            price: input?.price,
            contactPhone: input?.contactPhone,
            contactPhoneSecondary: input?.contactPhoneSecondary,
            contactNote: input?.contactNote,
            isActive: input?.isActive,
            displayOrder: input?.displayOrder,
            image: input?.image,
          }),
        })
      )
    ),
    update: makeMutationHook(async (input: any) =>
      normalizeCustomerProduct(
        await apiFetch(`/api/customer-products/${input.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: input?.name,
            description: input?.description,
            price: input?.price,
            contactPhone: input?.contactPhone,
            contactPhoneSecondary: input?.contactPhoneSecondary,
            contactNote: input?.contactNote,
            isActive: input?.isActive,
            displayOrder: input?.displayOrder,
            image: input?.image,
          }),
        })
      )
    ),
    remove: makeMutationHook(async (input: { id: number }) =>
      apiFetch(`/api/customer-products/${input.id}`, { method: "DELETE" })
    ),
  },
  reports: {
    getOverview: makeQueryHook(["reports", "getOverview"], async (input: any) => {
      const report = await apiFetch("/api/reports/general", undefined, normalizeFilters(input));
      const inventoryByStage = report?.inventoryByStage || [];
      const totalQuantity = inventoryByStage.reduce(
        (sum: number, item: any) => sum + Number(item.total_quantity || 0) + Number(item.total_defects || 0),
        0
      );
      const defectiveQuantity = inventoryByStage.reduce(
        (sum: number, item: any) => sum + Number(item.total_defects || 0),
        0
      );
      const readyRow = inventoryByStage.find((item: any) => item.current_stage === "ready");

      return {
        totalQuantity,
        healthyQuantity: Math.max(totalQuantity - defectiveQuantity, 0),
        readyQuantity: Number(readyRow?.total_quantity || 0),
        defectiveQuantity,
        realizedQuantity: Number(report?.summary?.sold_quantity || 0),
        shortageQuantity: 0,
        transferQuantity: Number(report?.summary?.transfers_count || 0),
        activeLocations: Number(report?.summary?.locations_count || 0),
        defectReportCount: inventoryByStage.filter((item: any) => Number(item.total_defects || 0) > 0).length,
      };
    }),
    getGeneral: makeQueryHook(["reports", "getGeneral"], async (input: any) => {
      const rows = await apiFetch("/api/reports/locations", undefined, normalizeFilters(input));
      return (rows || []).map((row: any) => ({
        locationId: row.id,
        locationName: row.location_name || row.name,
        locationCode: row.code || "",
        locationType: row.type || "greenhouse",
        openingTotals: {
          cassette: 0,
          grafting: 0,
          grafted: 0,
          sown: 0,
          ready: Number(row.total_stock || 0),
        },
        incomingReceived: 0,
        incomingTransfers: 0,
        outgoingTransfers: 0,
        totalEnding: Number(row.total_stock || 0),
        readyQuantity: Number(row.total_stock || 0),
        defectiveQuantity: Number(row.total_defects || 0),
        realizedQuantity: Number(row.sold_quantity || row.sold_orders || 0),
      }));
    }),
    getDetailed: makeQueryHook(["reports", "getDetailed"], async (input: any) => {
      const rows = await apiFetch("/api/seedlings", undefined, normalizeFilters(input));
      return (rows || []).map((row: any) => ({
        batchId: row.batch_id,
        batchNumber: row.batch_code,
        inventoryId: row.inventory_id,
        locationId: row.location_id,
        locationName: row.location_name,
        locationCode: row.location_code || "",
        locationType: row.location_type || "greenhouse",
        seedlingTypeName: row.seedling_type_name,
        fruitVarietyName: row.variety_name,
        rootstockTypeName: row.rootstock_type_name || null,
        stageKey: normalizeStage(row.current_stage),
        stageLabel: normalizeStage(row.current_stage),
        receivedAt: row.received_at_exact || row.received_date || row.batch_created_at || null,
        receivedStage: normalizeStage(row.received_stage || "cassette"),
        initialQuantity: Number(row.initial_quantity || 0),
        openingQuantity: Number(row.initial_quantity || 0),
        incomingQuantity: Number(row.quantity_available || 0),
        outgoingQuantity: 0,
        endingQuantity: Number(row.quantity_available || 0),
        defectiveQuantity: Number(row.defect_quantity || 0),
        readyQuantity: normalizeStage(row.current_stage) === "ready" ? Number(row.quantity_available || 0) : 0,
        realizedQuantity: 0,
      }));
    }),
    getMovements: makeQueryHook(["reports", "getMovements"], async (input: any) => {
      const rows = await apiFetch("/api/reports/movements", undefined, {
        ...normalizeFilters(input),
        includeAllDates: "true",
      });
      return (rows || []).map((row: any) => ({
        id: row.id,
        movementType: row.action_type || row.reference_type || "movement",
        transferDate: row.movement_date || row.transfer_date || row.created_at || new Date().toISOString(),
        movementDate: row.movement_date || row.transfer_date || row.created_at || new Date().toISOString(),
        batchNumber: row.batch_code,
        seedlingTypeName: row.seedling_type_name || "Aniqlanmagan",
        fruitVarietyName: row.variety_name || "Aniqlanmagan nav",
        stageOnTransfer: normalizeStage(row.next_stage || row.previous_stage || row.stage_on_transfer || row.current_stage || "cassette"),
        fromStage: row.previous_stage ? normalizeStage(row.previous_stage) : null,
        toStage: row.next_stage ? normalizeStage(row.next_stage) : null,
        fromLocationId: row.from_location_id,
        toLocationId: row.to_location_id,
        fromLocationName: row.from_location_name,
        fromLocationType: row.from_location_type || null,
        toLocationName: row.to_location_name,
        toLocationType: row.to_location_type || null,
        quantity: Number(row.quantity || 0),
        defectiveQuantity: Number(row.defect_quantity || 0),
        workflowStatus: normalizeTransfer(row).workflowStatus,
        transferType: row.transfer_type || row.action_type || "movement",
      }));
    }),
    getDefects: makeQueryHook(["reports", "getDefects"], async (input: any) => {
      const rows = await apiFetch("/api/seedlings", undefined, normalizeFilters(input));
      return (rows || [])
        .filter((row: any) => Number(row.defect_quantity || 0) > 0)
        .map((row: any) => ({
          createdAt: row.last_activity_at || new Date().toISOString(),
          batchNumber: row.batch_code,
          locationName: row.location_name,
          stageLabel: normalizeStage(row.current_stage),
          seedlingTypeName: row.seedling_type_name,
          fruitVarietyName: row.variety_name,
          quantity: Number(row.defect_quantity || 0),
          description: "Nuqsonli yozuv",
          imagePaths: [],
        }));
    }),
  },

  sensors: {
    // Joriy harorat (har bir teplitsa oxirgi o'qish)
    getLive: makeQueryHook(["sensors", "getLive"], async () => {
      const rows = await apiFetch("/api/sensors/live");
      return (rows || []).map((row: any) => ({
        locationId: row.location_id,
        locationName: row.location_name,
        locationType: row.location_type,
        temperature: row.temperature != null ? Number(row.temperature) : null,
        humidity: row.humidity != null ? Number(row.humidity) : null,
        recordedAt: row.recorded_at || null,
        deviceCode: row.device_code || null,
        lastSeenAt: row.last_seen_at || null,
        minutesAgo: row.minutes_ago != null ? Number(row.minutes_ago) : null,
      }));
    }),

    // Kunlik statistika (max, min, avg + vaqtlar)
    getDaily: makeQueryHook(
      ["sensors", "getDaily"],
      async (input?: { date?: string; locationId?: number }) => {
        const params = new URLSearchParams();
        if (input?.date) params.set("date", input.date);
        if (input?.locationId) params.set("locationId", String(input.locationId));
        const qs = params.toString();
        const data = await apiFetch(`/api/sensors/daily${qs ? `?${qs}` : ""}`);
        return {
          date: data?.date || input?.date || "",
          stats: (data?.stats || []).map((row: any) => ({
            locationId: row.location_id,
            locationName: row.location_name,
            maxTemp: row.max_temp != null ? Number(row.max_temp) : null,
            minTemp: row.min_temp != null ? Number(row.min_temp) : null,
            avgTemp: row.avg_temp != null ? Number(row.avg_temp) : null,
            avgHumidity: row.avg_humidity != null ? Number(row.avg_humidity) : null,
            maxAt: row.max_at || null,
            minAt: row.min_at || null,
            readingCount: Number(row.reading_count || 0),
          })),
        };
      }
    ),

    // Soatlik grafik (1 kun, 1 lokatsiya)
    getHistory: makeQueryHook(
      ["sensors", "getHistory"],
      async (input: { date?: string; locationId: number }) => {
        const params = new URLSearchParams();
        if (input.date) params.set("date", input.date);
        params.set("locationId", String(input.locationId));
        const data = await apiFetch(`/api/sensors/history?${params.toString()}`);
        return (data?.points || []).map((p: any) => ({
          timeLabel: p.time_label,
          temperature: p.temperature != null ? Number(p.temperature) : null,
          humidity: p.humidity != null ? Number(p.humidity) : null,
        }));
      }
    ),

    // Qurilmalar ro'yxati
    getDevices: makeQueryHook(["sensors", "getDevices"], async () => {
      const rows = await apiFetch("/api/sensors/devices");
      return (rows || []).map((row: any) => ({
        id: row.id,
        locationId: row.location_id,
        locationName: row.location_name,
        deviceCode: row.device_code,
        apiKey: row.api_key,
        label: row.label || null,
        isActive: Boolean(row.is_active),
        lastSeenAt: row.last_seen_at || null,
      }));
    }),

    // Yangi qurilma qo'shish
    addDevice: makeMutationHook(async (input: { locationId: number; deviceCode: string; label?: string }) =>
      apiFetch("/api/sensors/devices", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ),

    // Qurilmani o'chirish
    deleteDevice: makeMutationHook(async (deviceId: number) =>
      apiFetch(`/api/sensors/devices/${deviceId}`, { method: "DELETE" })
    ),
  },
};
