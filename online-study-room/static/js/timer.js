// Pomodoro Timer Configuration
// 番茄钟配置
const POMODORO_TIME = 25 * 60; // 25 minutes
const BREAK_TIME = 5 * 60;    // 5 minutes

// State Variables
// 状态变量
let timerState = {
    isWorking: true,
    timeLeft: POMODORO_TIME,
    timerInterval: null,
    isRunning: false
};

// DOM Elements
// DOM元素
const timerDisplay = document.getElementById('timer');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const toggleSoundBtn = document.getElementById('toggleSoundBtn');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskInput = document.getElementById('taskInput');
const durationInput = document.getElementById('durationInput');
const taskList = document.getElementById('taskList');
const ambientSound = document.getElementById('ambientSound');
const musicUpload = document.getElementById('musicUpload');
const musicList = document.getElementById('musicList');
const currentMusicName = document.getElementById('currentMusicName');
const folderSelect = document.getElementById('folderSelect');
const newFolderBtn = document.getElementById('newFolderBtn');
const folderNameInput = document.getElementById('folderNameInput');
const folderList = document.getElementById('folderList');
const deleteFolderBtn = document.getElementById('deleteFolderBtn');

// Current state
// 当前状态
let currentMusic = null;
let currentFolder = 'default';
let customSounds = [];
let db;

// Initialize database
// 初始化数据库
function initDatabase() {
    const request = indexedDB.open('studyRoomDB', 1);
    
    request.onupgradeneeded = function(event) {
        db = event.target.result;
        
        // Create object stores
        // 创建对象存储
        if (!db.objectStoreNames.contains('folders')) {
            const folderStore = db.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
            folderStore.createIndex('name', 'name', { unique: true });
        }
        
        if (!db.objectStoreNames.contains('sounds')) {
            const soundStore = db.createObjectStore('sounds', { keyPath: 'id', autoIncrement: true });
            soundStore.createIndex('folderId', 'folderId', { unique: false });
            soundStore.createIndex('name', 'name', { unique: false });
        }
        
        // Create default folder if it doesn't exist
        // 如果默认文件夹不存在，则创建
        const transaction = db.transaction(['folders'], 'readwrite');
        const store = transaction.objectStore('folders');
        const index = store.index('name');
        
        const getDefaultRequest = index.get('default');
        
        getDefaultRequest.onsuccess = function(event) {
            if (!event.target.result) {
                store.add({ name: 'default' });
            }
        };
    };
    
    request.onsuccess = function(event) {
        db = event.target.result;
        loadFolders();
        loadSounds();
    };
    
    request.onerror = function(event) {
        console.error('Database error: ' + event.target.errorCode);
    };
}

// Folder management
// 文件夹管理
function loadFolders() {
    const transaction = db.transaction(['folders'], 'readonly');
    const store = transaction.objectStore('folders');
    const index = store.index('name');
    
    const request = index.getAll();
    
    request.onsuccess = function(event) {
        const folders = event.target.result;
        folderList.innerHTML = '';
        
        folders.forEach(folder => {
            const li = document.createElement('li');
            li.className = folder.name === currentFolder ? 'active' : '';
            li.dataset.id = folder.id;
            li.dataset.name = folder.name;
            
            li.innerHTML = `
                <span>${folder.name}</span>
                <button onclick="selectFolder('${folder.name}')"><i class="fa fa-folder-open"></i></button>
            `;
            
            folderList.appendChild(li);
        });
        
        document.getElementById('currentFolderName').textContent = currentFolder;
    };
    
    request.onerror = function(event) {
        console.error('Error loading folders:', event.target.error);
    };
}

function createFolder(name) {
    if (!name.trim()) {
        alert('Folder name cannot be empty');
        return;
    }
    
    const transaction = db.transaction(['folders'], 'readwrite');
    const store = transaction.objectStore('folders');
    
    const request = store.add({ name: name });
    
    request.onsuccess = function(event) {
        folderNameInput.value = '';
        loadFolders();
        selectFolder(name);
    };
    
    request.onerror = function(event) {
        if (event.target.error.name === 'ConstraintError') {
            alert('Folder with this name already exists');
        } else {
            console.error('Error creating folder:', event.target.error);
            alert('Failed to create folder');
        }
    };
}

function selectFolder(name) {
    currentFolder = name;
    loadSounds();
    loadFolders();
}

function deleteCurrentFolder() {
    if (currentFolder === 'default') {
        alert('Cannot delete default folder');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete folder "${currentFolder}" and all its contents?`)) {
        return;
    }
    
    // First get folder ID
    const transaction = db.transaction(['folders'], 'readonly');
    const store = transaction.objectStore('folders');
    const index = store.index('name');
    
    const getFolderRequest = index.get(currentFolder);
    
    getFolderRequest.onsuccess = function(event) {
        const folder = event.target.result;
        if (!folder) return;
        
        // Delete all sounds in this folder
        const soundTransaction = db.transaction(['sounds'], 'readwrite');
        const soundStore = soundTransaction.objectStore('sounds');
        const soundIndex = soundStore.index('folderId');
        
        const soundRequest = soundIndex.openCursor(IDBKeyRange.only(folder.id));
        
        soundRequest.onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
        
        soundTransaction.oncomplete = function() {
            // Delete the folder
            const deleteFolderTransaction = db.transaction(['folders'], 'readwrite');
            const deleteFolderStore = deleteFolderTransaction.objectStore('folders');
            const deleteRequest = deleteFolderStore.delete(folder.id);
            
            deleteRequest.onsuccess = function() {
                currentFolder = 'default';
                loadFolders();
                loadSounds();
            };
        };
    };
}

// Sound management
// 声音管理
function loadSounds() {
    // Get current folder ID
    const folderTransaction = db.transaction(['folders'], 'readonly');
    const folderStore = folderTransaction.objectStore('folders');
    const folderIndex = folderStore.index('name');
    
    const folderRequest = folderIndex.get(currentFolder);
    
    folderRequest.onsuccess = function(event) {
        const folder = event.target.result;
        if (!folder) return;
        
        // Load sounds for this folder
        const transaction = db.transaction(['sounds'], 'readonly');
        const store = transaction.objectStore('sounds');
        const index = store.index('folderId');
        
        const request = index.getAll(folder.id);
        
        request.onsuccess = function(event) {
            customSounds = event.target.result;
            renderMusicList();
        };
        
        request.onerror = function(event) {
            console.error('Error loading sounds:', event.target.error);
        };
    };
}

function handleMusicUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if file is audio
    if (!file.type.startsWith('audio/')) {
        alert('Please upload an audio file');
        return;
    }
    
    // Get current folder ID
    const folderTransaction = db.transaction(['folders'], 'readonly');
    const folderStore = folderTransaction.objectStore('folders');
    const folderIndex = folderStore.index('name');
    
    const folderRequest = folderIndex.get(currentFolder);
    
    folderRequest.onsuccess = function(event) {
        const folder = event.target.result;
        if (!folder) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const audioUrl = e.target.result;
            
            // Save to database
            const transaction = db.transaction(['sounds'], 'readwrite');
            const store = transaction.objectStore('sounds');
            
            const sound = {
                name: file.name,
                url: audioUrl,
                folderId: folder.id,
                created: new Date().toISOString()
            };
            
            const request = store.add(sound);
            
            request.onsuccess = function(event) {
                sound.id = event.target.result;
                customSounds.push(sound);
                renderMusicList();
                selectMusic(sound.id);
            };
            
            request.onerror = function(event) {
                console.error('Error saving sound:', event.target.error);
                alert('Failed to save sound');
            };
        };
        
        reader.readAsDataURL(file);
    };
    
    // Clear the input
    musicUpload.value = '';
}

function renderMusicList() {
    musicList.innerHTML = '';
    
    customSounds.forEach(music => {
        const li = document.createElement('li');
        li.className = music.id === currentMusic?.id ? 'active' : '';
        li.dataset.id = music.id;
        
        li.innerHTML = `
            <span>${music.name}</span>
            <button onclick="selectMusic(${music.id})"><i class="fa fa-play"></i></button>
            <button onclick="deleteMusic(${music.id})"><i class="fa fa-trash"></i></button>
        `;
        
        musicList.appendChild(li);
    });
}

function selectMusic(id) {
    const music = customSounds.find(m => m.id === id);
    if (!music) return;
    
    currentMusic = music;
    ambientSound.src = music.url;
    currentMusicName.textContent = `Current: ${music.name}`;
    
    // Update active state in UI
    document.querySelectorAll('#musicList li').forEach(li => {
        li.classList.toggle('active', parseInt(li.dataset.id) === id);
    });
    
    // If sound was playing, restart it with new music
    if (!ambientSound.paused) {
        ambientSound.pause();
        ambientSound.currentTime = 0;
        ambientSound.play();
    }
}

function deleteMusic(id) {
    if (currentMusic?.id === id) {
        ambientSound.pause();
        currentMusic = null;
        currentMusicName.textContent = 'Current: None';
    }
    
    const transaction = db.transaction(['sounds'], 'readwrite');
    const store = transaction.objectStore('sounds');
    const request = store.delete(id);
    
    request.onsuccess = function() {
        customSounds = customSounds.filter(m => m.id !== id);
        renderMusicList();
    };
    
    request.onerror = function(event) {
        console.error('Error deleting sound:', event.target.error);
        alert('Failed to delete sound');
    };
}

// Task Management
// 任务管理
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        const tasks = await response.json();
        
        taskList.innerHTML = '';
        tasks.forEach(task => addTaskToDOM(task));
    } catch (error) {
        console.error('Failed to load tasks:', error);
    }
}

async function addTask() {
    const title = taskInput.value.trim();
    const duration = parseInt(durationInput.value);
    
    if (!title || !duration || duration <= 0) {
        alert('Please enter a valid task name and estimated time');
        return;
    }
    
    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, duration })
        });
        
        if (response.ok) {
            const task = await response.json();
            addTaskToDOM(task);
            taskInput.value = '';
            durationInput.value = '';
            updateStats();
        } else {
            throw new Error('Failed to add task');
        }
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Failed to add task. Please try again.');
    }
}

function addTaskToDOM(task) {
    const li = document.createElement('li');
    li.dataset.id = task.id;
    li.className = task.completed ? 'completed' : '';
    
    const actualTime = task.actual_time ? Math.floor(task.actual_time / 60) : 0;
    
    li.innerHTML = `
        <span class="task-title">${task.title}</span>
        <span class="task-duration">(${task.duration} minutes)</span>
        <span class="task-actual-time">Time spent: ${actualTime} minutes</span>
        <div class="task-actions">
            <button class="btn-complete" onclick="completeTask(${task.id})">
                ${task.completed ? '<i class="fa fa-check-circle"></i> Completed' : '<i class="fa fa-circle"></i> Mark Complete'}
            </button>
            <button class="btn-start" onclick="startTask(${task.id})">
                <i class="fa fa-play"></i> Start
            </button>
        </div>
    `;
    
    taskList.appendChild(li);
}

async function completeTask(taskId) {
    const taskElement = document.querySelector(`li[data-id="${taskId}"]`);
    const isCompleted = taskElement.classList.contains('completed');
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: !isCompleted })
        });
        
        if (response.ok) {
            taskElement.classList.toggle('completed');
            const completeBtn = taskElement.querySelector('.btn-complete');
            if (isCompleted) {
                completeBtn.innerHTML = '<i class="fa fa-circle"></i> Mark Complete';
            } else {
                completeBtn.innerHTML = '<i class="fa fa-check-circle"></i> Completed';
            }
            updateStats();
        } else {
            throw new Error('Failed to update task status');
        }
    } catch (error) {
        console.error('Error completing task:', error);
        alert('Failed to update task status. Please try again.');
    }
}

async function startTask(taskId) {
    // Remove active status from other tasks
    document.querySelectorAll('li.active-task').forEach(el => {
        el.classList.remove('active-task');
        const startBtn = el.querySelector('.btn-start');
        startBtn.innerHTML = '<i class="fa fa-play"></i> Start';
    });
    
    // Set current task as active
    const taskElement = document.querySelector(`li[data-id="${taskId}"]`);
    taskElement.classList.add('active-task');
    const startBtn = taskElement.querySelector('.btn-start');
    startBtn.innerHTML = '<i class="fa fa-spinner"></i> In Progress';
    
    // Reset and start timer
    resetTimer();
    startTimer();
}

async function updateTaskTime(taskId, time) {
    try {
        const taskElement = document.querySelector(`li[data-id="${taskId}"]`);
        const currentTimeEl = taskElement.querySelector('.task-actual-time');
        const currentTime = parseInt(currentTimeEl.textContent.replace(/\D/g, '')) * 60;
        
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actual_time: currentTime + time })
        });
        
        if (response.ok) {
            const updatedTask = await response.json();
            const newTime = Math.floor(updatedTask.actual_time / 60);
            currentTimeEl.textContent = `Time spent: ${newTime} minutes`;
            updateStats();
        } else {
            throw new Error('Failed to update task time');
        }
    } catch (error) {
        console.error('Error updating task time:', error);
    }
}

// Sound Control
// 声音控制
function toggleSound() {
    if (!currentMusic) {
        alert('Please select a music first');
        return;
    }
    
    if (ambientSound.paused) {
        ambientSound.play().catch(e => {
            console.error('Failed to play audio:', e);
            alert('Cannot play audio automatically. Please interact with the page first.');
        });
        toggleSoundBtn.innerHTML = '<i class="fa fa-volume-up"></i> Pause Ambient Sound';
    } else {
        ambientSound.pause();
        toggleSoundBtn.innerHTML = '<i class="fa fa-volume-off"></i> Play Ambient Sound';
    }
}

// Pomodoro Timer Functions
// 番茄钟功能函数
function startTimer() {
    if (timerState.isRunning) return;
    
    timerState.isRunning = true;
    startBtn.textContent = 'Pause';
    
    timerState.timerInterval = setInterval(() => {
        timerState.timeLeft--;
        
        if (timerState.timeLeft <= 0) {
            clearInterval(timerState.timerInterval);
            alert(timerState.isWorking ? "Focus session completed! Take a 5-minute break." : "Break time is over! Time to focus.");
            timerState.isWorking = !timerState.isWorking;
            timerState.timeLeft = timerState.isWorking ? POMODORO_TIME : BREAK_TIME;
            
            // Update task actual time
            const activeTask = document.querySelector('li.active-task');
            if (activeTask && timerState.isWorking) {
                const taskId = parseInt(activeTask.dataset.id);
                updateTaskTime(taskId, POMODORO_TIME);
            }
            
            startTimer();
        }
        
        updateTimerDisplay();
    }, 1000);
}

function pauseTimer() {
    if (!timerState.isRunning) return;
    
    clearInterval(timerState.timerInterval);
    timerState.isRunning = false;
    startBtn.textContent = 'Resume';
}

function resetTimer() {
    pauseTimer();
    timerState.isWorking = true;
    timerState.timeLeft = POMODORO_TIME;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerState.timeLeft / 60);
    const seconds = timerState.timeLeft % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Update timer style
    document.body.className = timerState.isWorking ? 'working' : 'break';
}

// Statistics Chart
// 统计图表
let progressChart;

function initChart() {
    const ctx = document.getElementById('progressChart').getContext('2d');
    
    progressChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Completed Tasks', 'Total Focus Time (minutes)'],
            datasets: [{
                label: 'Study Statistics',
                data: [0, 0],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(54, 162, 235, 0.7)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(54, 162, 235, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

async function updateStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        if (progressChart) {
            progressChart.data.datasets[0].data = [
                stats.completed_tasks,
                Math.floor(stats.total_time / 60)
            ];
            progressChart.update();
        }
    } catch (error) {
        console.error('Failed to update statistics:', error);
    }
}

// Initialization
// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    initDatabase();
    // Load task list
    loadTasks();
    // Initialize chart
    initChart();
    // Update statistics
    updateStats();
});

// Event Listeners
// 事件监听器
startBtn.addEventListener('click', () => {
    if (timerState.isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
});

resetBtn.addEventListener('click', resetTimer);
toggleSoundBtn.addEventListener('click', toggleSound);
addTaskBtn.addEventListener('click', addTask);
musicUpload.addEventListener('change', handleMusicUpload);

// Support adding tasks with Enter key
// 支持使用Enter键添加任务
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
});

durationInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
});    