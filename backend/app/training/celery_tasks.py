from app.core.celery_app import celery_app


@celery_app.task(bind=True, name="training.run_training")
def run_training_celery(self, task_id: str):
    """Celery task wrapper for the training pipeline."""
    from app.training.pipeline import run_training_task
    run_training_task(task_id)
