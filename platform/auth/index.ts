import { createAuth } from "./create";
import { getDb } from "../db";
import { voxaRuntime } from "../runtime";

function authConfig() {
  return createAuth(getDb(), { withNextCookies: true });
}

type AuthRuntime = {
  auth?: ReturnType<typeof authConfig>;
};

export function getAuth() {
  const runtime = voxaRuntime() as AuthRuntime;
  if (!runtime.auth) {
    runtime.auth = authConfig();
  }
  return runtime.auth;
}

export const auth = new Proxy({} as ReturnType<typeof authConfig>, {
  get(_target, property, receiver) {
    return Reflect.get(getAuth() as object, property, receiver);
  },
});
