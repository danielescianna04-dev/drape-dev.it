// Auto-detect and highlight active sidebar link
(function() {
    var path = window.location.pathname;
    var filename = path.split('/').pop();
    document.querySelectorAll('.sidebar-link').forEach(function(link) {
        var href = link.getAttribute('href');
        if (href && href.split('/').pop() === filename) {
            link.classList.add('active');
        }
    });
})();

// Generate Table of Contents from h2/h3 headings
function generateTOC() {
    var tocLinks = document.getElementById('tocLinks');
    var page = document.querySelector('.doc-page');
    if (!tocLinks || !page) return;
    tocLinks.innerHTML = '';
    var headings = page.querySelectorAll('h2, h3');
    headings.forEach(function(h, i) {
        // Skip headings inside FAQ section (handled separately)
        if (h.closest('.faq-section')) return;
        var id = 'toc-heading-' + i;
        h.id = id;
        var a = document.createElement('a');
        a.className = 'toc-link' + (h.tagName === 'H3' ? ' toc-h3' : '');
        a.textContent = h.textContent;
        a.href = '#' + id;
        a.setAttribute('data-toc-id', id);
        a.onclick = function(e) {
            e.preventDefault();
            tocLinks.querySelectorAll('.toc-link').forEach(function(l) { l.classList.remove('active'); });
            a.classList.add('active');
            tocClickLock = true;
            h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        tocLinks.appendChild(a);
    });
    // Add FAQ link if page has FAQ section
    var faqSection = page.querySelector('.faq-section');
    if (faqSection) {
        faqSection.id = 'toc-faq';
        var a = document.createElement('a');
        a.className = 'toc-link toc-faq';
        a.textContent = 'FAQs';
        a.href = '#toc-faq';
        a.setAttribute('data-toc-id', 'toc-faq');
        a.onclick = function(e) {
            e.preventDefault();
            tocLinks.querySelectorAll('.toc-link').forEach(function(l) { l.classList.remove('active'); });
            a.classList.add('active');
            tocClickLock = true;
            faqSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        tocLinks.appendChild(a);
    }
}

// FAQ accordion toggle
function toggleFaq(el) {
    var item = el.closest('.faq-item');
    var answer = item.querySelector('.faq-answer');
    var isOpen = item.classList.contains('open');
    // Close all FAQs in this section
    item.closest('.faq-section').querySelectorAll('.faq-item').forEach(function(fi) {
        fi.classList.remove('open');
        fi.querySelector('.faq-answer').style.maxHeight = null;
    });
    if (!isOpen) {
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
    }
}

// Scroll spy for TOC highlighting (paused during click-scroll)
var scrollSpyTimeout;
var tocClickLock = false;
var tocLockTimer;
window.addEventListener('scroll', function() {
    if (tocClickLock) {
        // Release lock only after scroll fully stops
        clearTimeout(tocLockTimer);
        tocLockTimer = setTimeout(function() { tocClickLock = false; }, 200);
        return;
    }
    clearTimeout(scrollSpyTimeout);
    scrollSpyTimeout = setTimeout(function() {
        var tocLinks = document.querySelectorAll('#tocLinks .toc-link');
        if (!tocLinks.length) return;
        var scrollPos = window.scrollY + 102;
        var current = null;
        document.querySelectorAll('.doc-page [id^="toc-"]').forEach(function(el) {
            if (el.getBoundingClientRect().top + window.scrollY - 102 <= scrollPos) {
                current = el.id;
            }
        });
        tocLinks.forEach(function(l) {
            l.classList.toggle('active', l.getAttribute('data-toc-id') === current);
        });
    }, 50);
});

// Filter sidebar links by search query
function filterSidebar(query) {
    var q = query.toLowerCase().trim();
    document.querySelectorAll('.sidebar-group').forEach(function(group) {
        var hasVisible = false;
        group.querySelectorAll('.sidebar-link').forEach(function(link) {
            var text = link.textContent.toLowerCase();
            var match = !q || text.includes(q);
            link.classList.toggle('hidden', !match);
            if (match) hasVisible = true;
        });
        group.classList.toggle('hidden', !hasVisible && q !== '');
    });
}

// Mobile sidebar toggle
function toggleSidebar() {
    document.getElementById('docsSidebar').classList.toggle('open');
    document.querySelector('.sidebar-backdrop').classList.toggle('open');
}
function closeSidebar() {
    document.getElementById('docsSidebar').classList.remove('open');
    document.querySelector('.sidebar-backdrop').classList.remove('open');
}

// Close nav dropdown on outside click
document.addEventListener('click', function(e) {
    document.querySelectorAll('.nav-dropdown').forEach(function(dd) {
        if (!dd.contains(e.target)) dd.classList.remove('open');
    });
});

// Feedback button handler (toggle)
function sendFeedback(btn, isPositive) {
    var wasSelected = btn.classList.contains('selected');
    var buttons = btn.closest('.feedback-buttons').querySelectorAll('.feedback-btn');
    buttons.forEach(function(b) { b.classList.remove('selected'); });
    var thanks = document.getElementById('feedbackThanks');
    if (wasSelected) {
        // Deselect
        if (thanks) thanks.classList.remove('show');
    } else {
        // Select
        btn.classList.add('selected');
        if (thanks) thanks.classList.add('show');
    }
}

// Initialize TOC on page load
generateTOC();
