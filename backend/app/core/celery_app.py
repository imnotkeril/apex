from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "apex",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    beat_schedule={
        "content.parse_all": {
            "task": "app.modules.content.tasks.parse_all_sources",
            "schedule": crontab(minute=0),
        },
        "content.recommendations": {
            "task": "app.modules.content.tasks.generate_recommendations",
            "schedule": crontab(minute=0, hour="*/6"),
        },
        "content.auto_publish": {
            "task": "app.modules.content.tasks.run_auto_mode",
            "schedule": crontab(minute=0),
        },
        "content.publish_due": {
            "task": "app.modules.content.tasks.publish_due_calendar",
            "schedule": crontab(minute="*"),
        },
        "content.sync_engagement": {
            "task": "app.modules.content.tasks.sync_engagement_stats",
            "schedule": crontab(hour=4, minute=0),
        },
        "content.archive_clusters": {
            "task": "app.modules.content.tasks.archive_old_clusters",
            "schedule": crontab(hour=3, minute=0),
        },
    },
    task_routes={
        "app.modules.*.tasks.*": {"queue": "modules"},
        "app.core.tasks.*": {"queue": "core"},
    },
)

celery_app.autodiscover_tasks(["app.core", "app.modules.content"])
