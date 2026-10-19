/**
 * Helper to analyze API and Network errors
 * and return friendly Indonesian messages explaining the failure reason.
 */
export function getFriendlyErrorMessage(err: any, defaultMessage?: string): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return "Sinyal internet terputus atau tidak ada koneksi (Offline). Harap periksa jaringan Wi-Fi atau paket data Anda.";
  }

  const msg = err?.message || String(err || "");
  const msgLower = msg.toLowerCase();

  // Common browser/network offline/timeout indicators
  if (
    msgLower.includes("fetch") || 
    msgLower.includes("network") || 
    msgLower.includes("timeout") || 
    msgLower.includes("failed to fetch") ||
    msgLower.includes("cors")
  ) {
    return "Sinyal internet tidak stabil atau gagal menghubungi server (Network Error / Timeout).";
  }

  // 401 Unauthorized
  if (msgLower.includes("401") || msgLower.includes("unauthorized") || msgLower.includes("auth")) {
    return "Sesi masuk Anda telah kedaluwarsa (401 Unauthorized). Silakan log out lalu login kembali untuk memperbarui izin.";
  }

  // 403 Forbidden
  if (msgLower.includes("403") || msgLower.includes("forbidden") || msgLower.includes("permission")) {
    return "Akses ditolak (403 Forbidden). Pastikan akun Anda memiliki hak akses edit pada database ini.";
  }

  // 404 Not Found
  if (msgLower.includes("404") || msgLower.includes("not found")) {
    return "Data tidak ditemukan (404 Not Found).";
  }

  // 429 Too Many Requests / Quota Limit
  if (
    msgLower.includes("429") || 
    msgLower.includes("too many requests") || 
    msgLower.includes("quota") || 
    msgLower.includes("rate limit") ||
    msgLower.includes("resource exhausted")
  ) {
    return "Batas kuota akses terlampaui (429 Rate Limit). Silakan tunggu sebentar sebelum mencoba kembali.";
  }

  // 500/503 Server Error
  if (msgLower.includes("500") || msgLower.includes("503") || msgLower.includes("server error")) {
    return "Terjadi kesalahan internal pada server (500 Internal Server Error). Silakan coba lagi setelah beberapa saat.";
  }

  if (defaultMessage) {
    return `${defaultMessage}: ${msg}`;
  }

  // Fallback with original message
  return `Kesalahan sistem: ${msg}`;
}
