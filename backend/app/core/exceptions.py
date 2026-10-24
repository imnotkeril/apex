from fastapi import FastAPI
from fastapi.responses import JSONResponse


class ApexException(Exception):
    def __init__(self, message: str, code: str = "APEX_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


class AIRouterException(ApexException):
    def __init__(self, task_type: str):
        super().__init__(
            message=f"All AI models failed for task: {task_type}",
            code="AI_ALL_MODELS_FAILED",
        )


class AIQuotaExceededException(ApexException):
    def __init__(self, current_cost: float, limit: float):
        super().__init__(
            message=f"Daily AI cost limit exceeded: ${current_cost:.2f} / ${limit:.2f}",
            code="AI_QUOTA_EXCEEDED",
        )


class ResourceNotFoundException(ApexException):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            message=f"{resource} with id {resource_id} not found",
            code="NOT_FOUND",
        )


class PermissionDeniedException(ApexException):
    def __init__(self, resource: str):
        super().__init__(
            message=f"Access denied to {resource}",
            code="PERMISSION_DENIED",
        )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AIQuotaExceededException)
    async def ai_quota_handler(_request, exc: AIQuotaExceededException):
        return JSONResponse(
            status_code=429,
            content={"error": exc.code, "message": exc.message},
        )

    @app.exception_handler(AIRouterException)
    async def ai_router_handler(_request, exc: AIRouterException):
        return JSONResponse(
            status_code=503,
            content={"error": exc.code, "message": exc.message},
        )

    @app.exception_handler(ApexException)
    async def apex_exception_handler(_request, exc: ApexException):
        return JSONResponse(
            status_code=400,
            content={"error": exc.code, "message": exc.message},
        )

    @app.exception_handler(ResourceNotFoundException)
    async def not_found_handler(_request, exc: ResourceNotFoundException):
        return JSONResponse(
            status_code=404,
            content={"error": exc.code, "message": exc.message},
        )

    @app.exception_handler(PermissionDeniedException)
    async def permission_handler(_request, exc: PermissionDeniedException):
        return JSONResponse(
            status_code=403,
            content={"error": exc.code, "message": exc.message},
        )
