export default function ToastMessage({ toast }) {
  return <div className={`toast ${toast ? "show" : ""}`} id="toast">{toast}</div>;
}
