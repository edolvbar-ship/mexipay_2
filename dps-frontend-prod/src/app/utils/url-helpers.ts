import { endpoints } from "../config/endpoints.config";

export function buildUrl(version: string, endpoint: string): string {
    return `${endpoints.apiBaseUrl}/${version}/${endpoint}`;
}