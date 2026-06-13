import { useLocation } from "wouter";

const styles = `
  .ag-404-box {
    max-width: 700px;
    margin: 0 auto;
    position: relative;
  }
  .ag-404-img {
    max-width: 100%;
    display: block;
  }
  .ag-404-img__first {
    position: absolute;
    top: 0;
    left: 0;
    animation: an-upDown 2s infinite;
  }
  .ag-404-img__last {
    position: absolute;
    top: 0;
    left: 0;
    animation: an-upDownInvert 2s infinite;
  }
  @keyframes an-upDown {
    0%   { transform: translateY(-10px); }
    50%  { transform: translateY(0); }
    100% { transform: translateY(-10px); }
  }
  @keyframes an-upDownInvert {
    0%   { transform: translateY(5px); }
    50%  { transform: translateY(0); }
    100% { transform: translateY(5px); }
  }
`;

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <div className="ag-404-box w-full" style={{ maxWidth: 500 }}>
        <img
          src="https://rawcdn.githack.com/SochavaAG/example-mycode/master/pens/animation-parallax-404/images/error-bot.png"
          className="ag-404-img ag-404-img__first"
          alt=""
        />
        <img
          src="https://rawcdn.githack.com/SochavaAG/example-mycode/master/pens/animation-parallax-404/images/error-med.png"
          className="ag-404-img"
          alt="404"
        />
        <img
          src="https://rawcdn.githack.com/SochavaAG/example-mycode/master/pens/animation-parallax-404/images/error-top.png"
          className="ag-404-img ag-404-img__last"
          alt=""
        />
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={() => setLocation("/")}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
        >
          ← Bosh sahifaga qaytish
        </button>
      </div>
    </div>
  );
}
