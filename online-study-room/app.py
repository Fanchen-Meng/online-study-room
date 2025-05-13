from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# 任务模型
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    duration = db.Column(db.Integer)  # 预计分钟数
    actual_time = db.Column(db.Integer, default=0)  # 实际用时(秒)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

# 初始化数据库
with app.app_context():
    db.create_all()

# 主页路由
@app.route('/')
def index():
    tasks = Task.query.all()
    return render_template('index.html', tasks=tasks)

# 添加新任务
@app.route('/api/tasks', methods=['POST'])
def add_task():
    data = request.json
    new_task = Task(title=data['title'], duration=data['duration'])
    db.session.add(new_task)
    db.session.commit()
    return jsonify({
        "id": new_task.id, 
        "title": new_task.title, 
        "duration": new_task.duration,
        "actual_time": new_task.actual_time,
        "completed": new_task.completed,
        "created_at": new_task.created_at.strftime('%Y-%m-%d %H:%M:%S')
    }), 201

# 更新任务
@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    
    # 更新实际用时
    if 'actual_time' in request.json:
        task.actual_time = request.json.get('actual_time', task.actual_time)
    
    # 更新完成状态
    if 'completed' in request.json:
        task.completed = request.json.get('completed', task.completed)
    
    db.session.commit()
    
    return jsonify({
        "status": "success", 
        "id": task.id, 
        "actual_time": task.actual_time,
        "completed": task.completed
    })

# 获取统计数据
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

if __name__ == '__main__':
    app.run(debug=True)    