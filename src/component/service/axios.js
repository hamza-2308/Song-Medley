// ================================================================
//  Preconfigured axios instance.
//  Import this instead of the raw `axios` package whenever you want
//  the request to be tied to the app's BASE_URL and share a common
//  default timeout / error interceptor.
//
//  Usage:
//    import http from "./service/axios";
//    import { API } from "./service/ipConfig";
//    const res = await http.get(API.songs.all);
// ================================================================

import axios from "axios";
import { BASE_URL } from "./ipConfig";

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // 60s — long enough for FFmpeg merges and file uploads
  headers: {
    Accept: "application/json",
  },
});

// Global error logging (does not swallow errors)
http.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log the actual server payload so the real SQL / exception
    // message is visible in DevTools instead of the generic axios error.
    console.error(
      "[API error]",
      error.config?.method?.toUpperCase(),
      error.config?.url,
      error.response?.status,
      error.response?.data
    );
    return Promise.reject(error);
  }
);

export default http;