class SchoolResultSystem {
        constructor() {
                this.gradeScale = {
                        'A+': { points: 80, min: 80, max: 100, desc: 'সন্তোষজনক' },
                        'A': { points: 70, min: 70, max: 79, desc: 'ভালো' },
                        'A-': { points: 60, min: 60, max: 69, desc: 'মোটামুটি' },
                        'B': { points: 50, min: 50, max: 59, desc: 'সাধারণ' },
                        'C': { points: 40, min: 40, max: 49, desc: 'কম' },
                        'F': { points: 0, min: 0, max: 39, desc: 'ফেল' }
                };
                this.subjects = JSON.parse(localStorage.getItem('school_results')) || [];
                this.studentInfo = JSON.parse(localStorage.getItem('student_info')) || {};
                this.totalMarks = 1000;
                this.classTotalMarks = {
                        '1': 600, '5': 800, '8': 900, '10': 1000, '12': 1100
                };
                this.init();
        }

        init() {
                this.bindEvents();
                this.loadStudentInfo();
                this.renderSubjects();
                this.updateResults();
                this.renderGradeScale();
                this.loadTheme();
        }

        bindEvents() {
                document.getElementById('addSubjectBtn').addEventListener('click', () => this.addSubject());
                document.getElementById('exportPdf').addEventListener('click', () => this.exportPDF());
                document.getElementById('resetAll').addEventListener('click', () => this.resetAll());
                document.getElementById('predictBtn').addEventListener('click', () => this.showPredictModal());
                document.getElementById('closePredict').addEventListener('click', () => this.closePredictModal());
                document.getElementById('calculatePredict').addEventListener('click', () => this.calculatePrediction());

                // Student info inputs
                ['studentName', 'studentRoll', 'studentReg'].forEach(id => {
                        const input = document.getElementById(id);
                        input.value = this.studentInfo[id.replace('student', '').toLowerCase()] || '';
                        input.addEventListener('input', () => this.saveStudentInfo());
                });

                document.getElementById('classSelector').addEventListener('change', (e) => {
                        this.updateTotalMarks(e.target.value);
                });

                document.getElementById('printBtn').addEventListener('click', () => window.print());
                document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        }

        // Subject Management
        addSubject() {
                this.subjects.push({
                        id: Date.now(),
                        name: '',
                        marks: 0,
                        fullMarks: 100,
                        grade: 'F',
                        pass: false
                });
                this.saveData();
                this.renderSubjects();
        }

        renderSubjects() {
                const container = document.getElementById('subjectsTable');
                container.innerHTML = '';

                if (this.subjects.length === 0) {
                        container.innerHTML = `
                <div style="text-align: center; padding: 60px; color: var(--text-secondary);">
                    <i class="fas fa-book-open" style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>কোনো বিষয় যোগ করা হয়নি</h3>
                    <p>"নতুন বিষয়" বাটনে ক্লিক করে শুরু করুন</p>
                </div>
            `;
                        return;
                }

                this.subjects.forEach((subject) => {
                        const row = document.createElement('div');
                        row.className = `subject-row ${subject.pass ? 'pass' : 'fail'}`;
                        row.dataset.subjectId = subject.id;
                        row.innerHTML = `
                <input type="text" class="subject-input" placeholder="বিষয়ের নাম (বাংলা/ইংরেজি)" value="${subject.name}" data-field="name">
                <div class="marks-input">
                    <input type="number" class="subject-input marks" min="0" max="${subject.fullMarks}" value="${subject.marks}" data-field="marks">
                    <span class="full-marks">/${subject.fullMarks}</span>
                </div>
                <select class="subject-input grade" data-field="grade">
                    ${Object.keys(this.gradeScale).map(grade =>
                                `<option value="${grade}" ${subject.grade === grade ? 'selected' : ''}>${grade}</option>`
                        ).join('')}
                </select>
                <div class="subject-status">
                    ${subject.pass ? '<i class="fas fa-check-circle text-success"></i>' : '<i class="fas fa-times-circle text-danger"></i>'}
                </div>
                <button class="btn-icon btn-danger" data-action="delete" title="বিষয় মুছুন">
                    <i class="fas fa-trash"></i>
                </button>
            `;
                        container.appendChild(row);
                });

                // Bind events to inputs
                container.querySelectorAll('.subject-input').forEach(input => {
                        input.addEventListener('input', (e) => this.updateSubject(e));
                });

                container.querySelectorAll('[data-action="delete"]').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                                this.deleteSubject(parseInt(e.target.closest('.subject-row').dataset.subjectId));
                        });
                });
        }

        updateSubject(event) {
                const row = event.target.closest('.subject-row');
                const subjectId = parseInt(row.dataset.subjectId);
                const subject = this.subjects.find(s => s.id === subjectId);
                const field = event.target.dataset.field;

                if (field === 'marks') {
                        const marks = parseFloat(event.target.value) || 0;
                        subject.marks = Math.max(0, Math.min(subject.fullMarks, marks));
                        subject.pass = subject.marks >= 40;
                        subject.grade = this.getGradeFromMarks(subject.marks);
                } else {
                        subject[field] = event.target.value;
                }

                // Update UI
                row.className = `subject-row ${subject.pass ? 'pass' : 'fail'}`;
                row.querySelector('.grade').value = subject.grade;
                row.querySelector('.subject-status').innerHTML = subject.pass ?
                        '<i class="fas fa-check-circle text-success"></i>' : '<i class="fas fa-times-circle text-danger"></i>';

                this.saveData();
                this.updateResults();
        }

        deleteSubject(subjectId) {
                if (confirm('এই বিষয়টি মুছে ফেলবেন?')) {
                        this.subjects = this.subjects.filter(s => s.id !== subjectId);
                        this.saveData();
                        this.renderSubjects();
                        this.updateResults();
                }
        }

        getGradeFromMarks(marks) {
                for (const [grade, data] of Object.entries(this.gradeScale)) {
                        if (marks >= data.min && marks <= data.max) {
                                return grade;
                        }
                }
                return 'F';
        }

        // Results Calculation
        updateResults() {
                let totalObtained = 0;
                let totalFullMarks = 0;
                let passedSubjects = 0;
                let totalSubjects = this.subjects.length;

                this.subjects.forEach(subject => {
                        totalObtained += subject.marks;
                        totalFullMarks += subject.fullMarks;
                        if (subject.pass) passedSubjects++;
                });

                const percentage = totalFullMarks > 0 ? ((totalObtained / totalFullMarks) * 100).toFixed(2) : 0;
                const gradeLetter = this.getOverallGrade(percentage);
                const position = this.getPosition(percentage);

                // Update DOM
                document.getElementById('percentage').textContent = `${percentage}%`;
                document.getElementById('totalObtained').textContent = totalObtained.toLocaleString();
                document.getElementById('totalSubjects').textContent = `${passedSubjects}/${totalSubjects}`;
                document.getElementById('gradeLetter').textContent = gradeLetter;
                document.getElementById('position').textContent = position;

                this.updateResultColors(percentage);
                this.showPositionTable(percentage);
        }

        getOverallGrade(percentage) {
                for (const [grade, data] of Object.entries(this.gradeScale)) {
                        if (percentage >= data.min) return grade;
                }
                return 'F';
        }

        getPosition(percentage) {
                if (percentage >= 80) return '১ম স্থান';
                if (percentage >= 70) return '২য় স্থান';
                if (percentage >= 60) return '৩য় স্থান';
                if (percentage >= 45) return 'পাস';
                return 'ফেল';
        }

        updateResultColors(percentage) {
                const percentEl = document.getElementById('percentage');
                const positionEl = document.getElementById('position');

                if (percentage >= 80) {
                        percentEl.style.color = '#10B981';
                        positionEl.style.color = '#10B981';
                } else if (percentage >= 60) {
                        percentEl.style.color = '#F59E0B';
                        positionEl.style.color = '#F59E0B';
                } else {
                        percentEl.style.color = '#EF4444';
                        positionEl.style.color = '#EF4444';
                }
        }

        showPositionTable(percentage) {
                const section = document.getElementById('positionTableSection');
                if (percentage >= 60) {
                        section.style.display = 'block';
                        this.renderPositionTable();
                } else {
                        section.style.display = 'none';
                }
        }

        renderPositionTable() {
                const container = document.getElementById('positionTableSection').querySelector('.position-list');
                container.innerHTML = `
            <div class="position-item gold">
                <span class="position-rank">১</span>
                <span class="position-name">৮০%+</span>
                <i class="fas fa-trophy"></i>
            </div>
            <div class="position-item silver">
                <span class="position-rank">২</span>
                <span class="position-name">৭০-৭৯%</span>
                <i class="fas fa-medal"></i>
            </div>
            <div class="position-item bronze">
                <span class="position-rank">৩</span>
                <span class="position-name">৬০-৬৯%</span>
                <i class="fas fa-award"></i>
            </div>
        `;
        }

        // Student Management
        loadStudentInfo() {
                document.getElementById('studentName').value = this.studentInfo.name || '';
                document.getElementById('studentRoll').value = this.studentInfo.roll || '';
                document.getElementById('studentReg').value = this.studentInfo.reg || '';
        }

        saveStudentInfo() {
                this.studentInfo = {
                        name: document.getElementById('studentName').value,
                        roll: document.getElementById('studentRoll').value,
                        reg: document.getElementById('studentReg').value
                };
                localStorage.setItem('student_info', JSON.stringify(this.studentInfo));
        }

        updateTotalMarks(classValue) {
                if (classValue && this.classTotalMarks[classValue]) {
                        this.totalMarks = this.classTotalMarks[classValue];
                }
                document.getElementById('totalMarks').innerHTML = `মোট নম্বর: <strong>${this.totalMarks}</strong>`;
                this.updateResults();
        }

        // Storage
        saveData() {
                localStorage.setItem('school_results', JSON.stringify(this.subjects));
        }

        // Theme
        toggleTheme() {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
                localStorage.setItem('theme', isDark ? 'light' : 'dark');
        }

        loadTheme() {
                const theme = localStorage.getItem('theme') || 'light';
                document.documentElement.setAttribute('data-theme', theme);
        }

        // PDF Export
        async exportPDF() {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');

                // Header
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.text('শিক্ষার্থী রেজাল্ট শিট', 20, 25);

                // Student Info
                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                const student = this.studentInfo;
                doc.text(`নাম: ${student.name || 'N/A'}`, 20, 40);
                doc.text(`রোল: ${student.roll || 'N/A'}`, 20, 50);
                doc.text(`রেজি: ${student.reg || 'N/A'}`, 20, 60);
                doc.text(`মোট নম্বর: ${this.totalMarks}`, 20, 70);

                // Results
                doc.setFont('helvetica', 'bold');
                doc.text('ফলাফল:', 20, 85);
                doc.setFont('helvetica', 'normal');
                doc.text(`পাওয়া নম্বর: ${document.getElementById('totalObtained').textContent}`, 20, 95);
                doc.text(`পার্সেন্টেজ: ${document.getElementById('percentage').textContent}`, 20, 105);
                doc.text(`গ্রেড: ${document.getElementById('gradeLetter').textContent}`, 20, 115);
                doc.text(`পজিশন: ${document.getElementById('position').textContent}`, 20, 125);

                // Subjects Table
                let y = 140;
                doc.text('বিষয়ভিত্তিক ফলাফল:', 20, y);
                y += 10;

                this.subjects.forEach((subject, i) => {
                        if (y > 270) {
                                doc.addPage();
                                y = 20;
                        }
                        doc.text(`${i + 1}. ${subject.name}: ${subject.marks}/${subject.fullMarks} (${subject.grade})`, 25, y);
                        y += 7;
                });

                doc.save(`Result_${this.studentInfo.roll || 'Student'}_${Date.now()}.pdf`);
        }

        // Prediction Modal
        showPredictModal() {
                document.getElementById('predictModal').style.display = 'flex';
        }

        closePredictModal() {
                document.getElementById('predictModal').style.display = 'none';
        }

        calculatePrediction() {
                const targetPercent = parseFloat(document.getElementById('targetPercent').value);
                const remainingSubjects = parseInt(document.getElementById('remainingSubjects').value);
                const currentObtained = this.subjects.reduce((sum, s) => sum + s.marks, 0);
                const currentTotal = this.subjects.reduce((sum, s) => sum + s.fullMarks, 0);

                const targetTotal = (targetPercent / 100) * this.totalMarks;
                const remainingTotalMarks = this.totalMarks - currentTotal;
                const marksNeeded = targetTotal - currentObtained;
                const avgPerSubject = (marksNeeded / remainingSubjects).toFixed(2);

                const resultEl = document.getElementById('predictResult');
                if (avgPerSubject > 100) {
                        resultEl.innerHTML = `<div class="predict-fail">অসম্ভব! ${avgPerSubject}% প্রয়োজন</div>`;
                } else {
                        resultEl.innerHTML = `
                <div class="predict-success">
                    <strong>প্রতি বিষয়ে ${avgPerSubject}%</strong> লাগবে
                    <br>মোট: ${marksNeeded.toFixed(0)}/${remainingTotalMarks}
                </div>
            `;
                }
        }

        // Reset
        resetAll() {
                if (confirm('সব তথ্য মুছে ফেলবেন? এই কাজটি পুনরায় করা যাবে না!')) {
                        this.subjects = [];
                        localStorage.removeItem('school_results');
                        this.renderSubjects();
                        this.updateResults();
                }
        }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
        new SchoolResultSystem();
});

// Print Styles
// @media print {
//     .header - actions, .results - actions, .btn - icon { display: none!important; }
//     .main { background: white!important; }
//     .subject - row.fail { background: #fee!important; }
// }