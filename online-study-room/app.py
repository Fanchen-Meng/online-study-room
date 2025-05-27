from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Create Flask application instance
# 创建Flask应用实例
app = Flask(__name__)
# Configure database connection
# 配置数据库连接
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
db = SQLAlchemy(app)

# Task model for database
# 数据库任务模型
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)  # Task title
    duration = db.Column(db.Integer)  # Estimated minutes
    actual_time = db.Column(db.Integer, default=0)  # Actual time spent (seconds)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

# Initialize database
# 初始化数据库
with app.app_context():
    db.create_all()

# Home page route
# 主页路由
@app.route('/')
def index():
    tasks = Task.query.all()
    return render_template('index.html', tasks=tasks)

# API route to add a new task
# 添加新任务的API路由
@app.route('/api/tasks', methods=['POST'])
def add_task():
    data = request.json
    new_task = Task(title=data['title'], duration=data['duration'])
    db.session.add(new_task)
    db.session.commit()
    return jsonify({"id": new_task.id, "title": new_task.title, "duration": new_task.duration}), 201

# API route to update a task
# 更新任务的API路由
@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    task.actual_time = request.json.get('actual_time', task.actual_time)
    task.completed = request.json.get('completed', task.completed)
    db.session.commit()
    return jsonify({"status": "success", "id": task.id, "actual_time": task.actual_time, "completed": task.completed})

# API route to get statistics
# 获取统计信息的API路由
@app.route('/api/stats', methods=['GET'])
def get_stats():
    total_tasks = Task.query.count()
    completed_tasks = Task.query.filter_by(completed=True).count()
    total_time = sum(task.actual_time for task in Task.query.all())
    
    return jsonify({
        'total_tasks': total_tasks,
        'completed_tasks': completed_tasks,
        'total_time': total_time
    })

# Run the application
# 运行应用
if __name__ == '__main__':
    app.run(debug=True) 