import { Controller } from '@hotwired/stimulus';

export default class extends Controller {
    static targets = ['question', 'submit', 'status'];
    connect() { this.pending = false; }
    choose(event) {
        this.questionTarget.value = event.currentTarget.dataset.question;
        this.questionTarget.dispatchEvent(new Event('input', { bubbles: true }));
        this.questionTarget.focus();
    }
    shortcut(event) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            this.questionTarget.form.requestSubmit();
        }
    }
    send(event) {
        if (this.pending) { event.preventDefault(); return; }
        this.pending = true;
        this.submitTarget.disabled = true;
        this.statusTarget.textContent = 'Finding sources and preparing your answer…';
        this.questionTarget.form.setAttribute('aria-busy', 'true');
    }
    restore() {
        this.pending = false;
        this.submitTarget.disabled = false;
        this.statusTarget.textContent = '';
        this.questionTarget.form.removeAttribute('aria-busy');
    }
}
