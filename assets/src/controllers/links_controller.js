import { Controller } from '@hotwired/stimulus';

// Covers both restored history and answers appended by streaming transports.
export default class extends Controller {
    connect() {
        this.update();
        this.observer = new MutationObserver(() => this.update());
        this.observer.observe(this.element, { childList: true, subtree: true });
    }
    disconnect() { this.observer?.disconnect(); }
    update() {
        for (const link of this.element.querySelectorAll('a[href]')) {
            if (link.getAttribute('href').startsWith('#')) continue;
            if (!['http:', 'https:'].includes(new URL(link.href, document.baseURI).protocol)) continue;
            link.target = '_blank';
            link.relList.add('noopener', 'noreferrer');
            if (!link.querySelector('.icon-external')) {
                const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                icon.setAttribute('class', 'icon-external');
                icon.setAttribute('width', '14'); icon.setAttribute('height', '14');
                icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('fill', 'none');
                icon.setAttribute('stroke', 'currentColor'); icon.setAttribute('stroke-width', '2');
                icon.setAttribute('aria-hidden', 'true');
                icon.innerHTML = '<path d="M15 3h6v6M10 14 21 3M21 14v7H3V3h7"/>';
                link.append(icon);
            }
        }
    }
}
