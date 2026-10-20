import "server-only";

import { unstable_rethrow } from "next/navigation";

import { describeError } from "./api";

export type Loaded<T> = { data: T; error: null } | { data: null; error: string };

/** Await an API call for a page; failures become a message instead of a crashed route. */
export async function load<T>(promise: Promise<T>): Promise<Loaded<T>> {
  try {
    return { data: await promise, error: null };
  } catch (error) {
    unstable_rethrow(error);
    return { data: null, error: describeError(error) };
  }
}

export function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
