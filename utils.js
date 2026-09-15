/* ============================================================
   UTILS — Utility Functions
   ============================================================ */

const Utils = {
    /**
     * Show a toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span>${this.escapeHTML(message)}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    /**
     * Format Firestore timestamp or Date to DD.MM.YYYY
     */
    formatDate(timestamp) {
        if (!timestamp) return '—';
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    },

    /**
     * Format to DD.MM (short)
     */
    formatDateShort(timestamp) {
        if (!timestamp) return '—';
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}.${month}`;
    },

    /**
     * Generate random 6-char invite code (ABC123 format)
     */
    generateInviteCode() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const digits = '0123456789';
        let code = '';
        for (let i = 0; i < 3; i++) code += letters[Math.floor(Math.random() * letters.length)];
        for (let i = 0; i < 3; i++) code += digits[Math.floor(Math.random() * digits.length)];
        return code;
    },

    /**
     * Get full day name
     */
    getDayName(dayIndex) {
        const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        return days[dayIndex] || '';
    },

    /**
     * Get short day name
     */
    getDayShortName(dayIndex) {
        const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return days[dayIndex] || '';
    },

    /**
     * Get CSS class for grade value
     */
    getGradeColor(grade) {
        const colors = { 5: 'grade-5', 4: 'grade-4', 3: 'grade-3', 2: 'grade-2', 1: 'grade-1' };
        return colors[grade] || '';
    },

    /**
     * Calculate average of grades array
     */
    calculateAverage(grades) {
        if (!grades || grades.length === 0) return '—';
        const sum = grades.reduce((a, b) => a + b, 0);
        return (sum / grades.length).toFixed(1);
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Remove all children from element
     */
    clearElement(el) {
        if (typeof el === 'string') el = document.getElementById(el);
        if (el) el.innerHTML = '';
    },

    /**
     * Create DOM element
     */
    createElement(tag, classes, innerHTML) {
        const el = document.createElement(tag);
        if (classes) el.className = classes;
        if (innerHTML) el.innerHTML = innerHTML;
        return el;
    },

    /**
     * Simple confirm dialog
     */
    confirmAction(message) {
        return confirm(message);
    },

    /**
     * Fill select element with options
     */
    setSelectOptions(selectId, options, placeholder = 'Выберите...') {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = `<option value="" disabled selected>${this.escapeHTML(placeholder)}</option>`;
        options.forEach(opt => {
            const option = document.createElement('option');
            if (typeof opt === 'object') {
                option.value = opt.value;
                option.textContent = opt.text;
            } else {
                option.value = opt;
                option.textContent = opt;
            }
            select.appendChild(option);
        });
    },

    /**
     * Get emoji for a subject
     */
    getSubjectEmoji(subject) {
        const emojis = {
            'Математика': '📐',
            'Русский язык': '📝',
            'Литература': '📖',
            'Физика': '⚛️',
            'Химия': '🧪',
            'Биология': '🧬',
            'История': '🏛️',
            'География': '🌍',
            'Английский язык': '🇬🇧',
            'Информатика': '💻',
            'Физкультура': '⚽',
            'Музыка': '🎵',
            'ИЗО': '🎨',
            'Технология': '🔧',
            'ОБЖ': '🛡️'
        };
        return emojis[subject] || '📚';
    },

    /**
     * Check if a date is in the past
     */
    isOverdue(timestamp) {
        let date;
        if (timestamp.toDate) date = timestamp.toDate();
        else if (timestamp instanceof Date) date = timestamp;
        else date = new Date(timestamp);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    },

    /**
     * Show empty state placeholder
     */
    showEmptyState(containerId, icon, message) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-${icon}"></i>
                <p>${message}</p>
            </div>
        `;
    }
};

window.Utils = Utils;
