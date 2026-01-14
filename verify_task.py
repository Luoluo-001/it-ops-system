from app import app, db, SystemConfig, PlanTask, PlanTaskPreparation
import json
from datetime import datetime, timedelta

def verify():
    with app.app_context():
        # 1. 获取机器人配置
        config = SystemConfig.query.filter_by(config_key='alert_robots').first()
        if not config:
            print("ERROR: No alert robots configured.")
            return
        
        try:
            robots = json.loads(config.config_value)
            if not robots:
                print("ERROR: Alert robots list is empty.")
                return
            robot = robots[0]
        except Exception as e:
            print(f"ERROR: Failed to parse robots: {e}")
            return

        # 2. 创建测试任务
        # 计划时间设定为 3 分钟后
        now = datetime.now()
        plan_time = now + timedelta(minutes=3)
        
        task = PlanTask(
            title="AI 自动验证任务",
            task_type="系统测试",
            plan_time=plan_time,
            reminder_minutes=1, # 提前1分钟提醒
            reminder_enabled=True,
            alert_robot=robot.get('name'),
            webhook_url=robot.get('webhook'),
            reminder_message="这是一条由 AI 发起的验证通知。任务时间：{plan_time}，进度：{prep_progress}。",
            status="待执行",
            owner="AI助手",
            responsible="AI助手"
        )
        
        db.session.add(task)
        db.session.flush()
        
        # 增加一个准备事项
        prep = PlanTaskPreparation(
            task_id=task.id,
            description="自动检查环境",
            status="已完成",
            order_no=1
        )
        db.session.add(prep)
        
        db.session.commit()
        
        print(f"SUCCESS: Created task '{task.title}' (ID: {task.id})")
        print(f"Current Time: {now.strftime('%H:%M:%S')}")
        print(f"Plan Time: {plan_time.strftime('%H:%M:%S')}")
        print(f"Expected Reminder Time: {(plan_time - timedelta(minutes=1)).strftime('%H:%M:%S')}")

if __name__ == "__main__":
    verify()
