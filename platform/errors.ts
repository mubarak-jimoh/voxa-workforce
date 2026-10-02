export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export class UnauthenticatedError extends AppError {
  constructor() {
    super("unauthenticated", "You need to sign in to continue.", 401);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that.") {
    super("forbidden", message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super("not_found", message, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("conflict", message, 409);
    this.name = "ConflictError";
  }
}

export class InvalidTransitionError extends AppError {
  constructor(message: string) {
    super("invalid_transition", message, 422);
    this.name = "InvalidTransitionError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("validation", message, 400);
    this.name = "ValidationError";
  }
}
