from app import app, db, NotificationAudit, PlanTask
from datetime import datetime

def check():
    with app.app_context():
        now = datetime.now()
        print(f"Current Time: {now}")
        
        # 1. 检查审计记录
        audits = NotificationAudit.query.filter(NotificationAudit.sent_at >= '2026-01-12 20:10:00').all()
        print(f"\n--- Notification Audits (since 20:10) ---")
        if not audits:
            print("No audit records found.")
        for a in audits:
            print(f"[{a.sent_at}] Task: {a.task_title}, Status: {a.status}, Error: {a.error_msg}")

        # 2. 检查任务状态
        tasks = PlanTask.query.filter(PlanTask.title == "AI 自动验证任务").all()
        print(f"\n--- Task Status ---")
        for t in tasks:
            print(f"Task: {t.title}, ID: {t.id}, Plan: {t.plan_time}, Reminder: {t.reminder_minutes}min, Sent: {t.reminder_sent}")

if __name__ == "__main__":
    check()
