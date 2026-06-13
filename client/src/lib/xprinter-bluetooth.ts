// XPrinter va boshqa ESC/POS thermal printerlar uchun Web Bluetooth yordamida chop etish

const XPRINTER_SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const XPRINTER_CHAR_UUID = "00002af1-0000-1000-8000-00805f9b34fb";

// ESC/POS buyruqlari
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const CR = 0x0d;

function escposInit(): Uint8Array {
  return new Uint8Array([ESC, 0x40]);
}

function escposText(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

function escposLineFeed(count = 1): Uint8Array {
  return new Uint8Array(Array(count).fill(LF));
}

function escposCut(): Uint8Array {
  return new Uint8Array([GS, 0x56, 0x00]);
}

function escposBold(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 1 : 0]);
}

function escposCenter(): Uint8Array {
  return new Uint8Array([ESC, 0x61, 0x01]);
}

function escposLeft(): Uint8Array {
  return new Uint8Array([ESC, 0x61, 0x00]);
}

function escposLargeFont(on: boolean): Uint8Array {
  return new Uint8Array([GS, 0x21, on ? 0x11 : 0x00]);
}

function escposQrCode(data: string): Uint8Array {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const dataLen = dataBytes.length + 3;
  const pL = dataLen & 0xff;
  const pH = (dataLen >> 8) & 0xff;

  return new Uint8Array([
    // Model
    GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
    // Size (modul: 4)
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x04,
    // Error correction: M
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31,
    // Data
    GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30,
    ...dataBytes,
    // Print
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
  ]);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export type BatchPrintData = {
  batchCode: string;
  seedlingTypeName: string;
  varietyName: string;
  rootstockName?: string;
  locationName: string;
  quantity: number;
  receivedDate: string;
  qrPayload: string;
};

export function buildBatchReceiptBytes(data: BatchPrintData): Uint8Array {
  const line = "--------------------------------\n";
  const date = new Date().toLocaleString("uz-UZ");

  return concatBytes(
    escposInit(),
    escposCenter(),
    escposBold(true),
    escposLargeFont(true),
    escposText("KO'CHAT PARTIYASI\n"),
    escposLargeFont(false),
    escposBold(false),
    escposText(line),
    escposLeft(),
    escposText(`Partiya: ${data.batchCode}\n`),
    escposText(`Tur: ${data.seedlingTypeName}\n`),
    escposText(`Nav: ${data.varietyName}\n`),
    data.rootstockName ? escposText(`Payvandtag: ${data.rootstockName}\n`) : new Uint8Array(0),
    escposText(`Obyekt: ${data.locationName}\n`),
    escposText(`Miqdor: ${data.quantity} ta\n`),
    escposText(`Kirim sanasi: ${data.receivedDate}\n`),
    escposText(`Chop: ${date}\n`),
    escposText(line),
    escposCenter(),
    escposQrCode(data.qrPayload),
    escposLineFeed(2),
    escposLeft(),
    escposText(line),
    escposLineFeed(3),
    escposCut()
  );
}

async function writeToCharacteristic(
  characteristic: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array,
  chunkSize = 512
): Promise<void> {
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const chunk = data.slice(offset, offset + chunkSize);
    await characteristic.writeValue(chunk);
    // Printerga ishlov berish vaqti
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export type BluetoothPrintResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "cancelled" | "connect_failed" | "write_failed"; message: string };

export async function printViaBluetooth(data: Uint8Array): Promise<BluetoothPrintResult> {
  if (!navigator.bluetooth) {
    return {
      ok: false,
      reason: "unsupported",
      message: "Bu brauzer Bluetooth-ni qo'llab-quvvatlamaydi. Chrome yoki Edge ishlating.",
    };
  }

  let device: BluetoothDevice;
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [XPRINTER_SERVICE_UUID] }],
      optionalServices: [XPRINTER_SERVICE_UUID],
    });
  } catch {
    // Foydalanuvchi qurilma tanlashni bekor qildi
    return { ok: false, reason: "cancelled", message: "Printer tanlanmadi." };
  }

  try {
    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(XPRINTER_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(XPRINTER_CHAR_UUID);
    await writeToCharacteristic(characteristic, data);
    await server.disconnect();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: "write_failed",
      message: `Printer bilan bog'lanishda xatolik: ${err instanceof Error ? err.message : "noma'lum xato"}`,
    };
  }
}

export async function printBatchReceipt(data: BatchPrintData): Promise<BluetoothPrintResult> {
  const bytes = buildBatchReceiptBytes(data);
  return printViaBluetooth(bytes);
}
