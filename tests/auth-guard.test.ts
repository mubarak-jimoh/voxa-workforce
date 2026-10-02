import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { UnauthenticatedError } from "@/platform/errors";
import {
  hasSessionCookie,
  isAuthPath,
  isProtectedPath,
} from "@/platform/auth/cookies";
import { proxy } from "../proxy";

describe("unauthenticated access", () => {
  it("treats missing session as unauthenticated in the domain", () => {
    expect(() => {
      throw new UnauthenticatedError();
    }).toThrow(UnauthenticatedError);
  });

  it("classifies protected and auth paths", () => {
    expect(isProtectedPath("/employee")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/sign-in")).toBe(false);
    expect(isAuthPath("/sign-in")).toBe(true);
    expect(hasSessionCookie(null)).toBe(false);
    expect(hasSessionCookie("better-auth.session_token=abc")).toBe(true);
  });

  it("redirects unauthenticated requests away from protected routes", () => {
    const request = new NextRequest("http://localhost:3000/employee");
    const response = proxy(request);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?next=%2Femployee",
    );
  });

  it("allows protected routes when a session cookie is present", () => {
    const request = new NextRequest("http://localhost:3000/employee", {
      headers: { cookie: "better-auth.session_token=test-token" },
    });
    const response = proxy(request);
    expect(response.headers.get("location")).toBeNull();
  });
});
