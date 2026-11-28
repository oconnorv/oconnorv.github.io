// Shared script for the file pages (About, CV, CV of Failures, Contact).

// [CLOSE TAB] closes this tab and drops the visitor back on the paused game.
// If the browser won't let a script close the tab (e.g. the page was opened directly), go home instead.
for (const b of document.querySelectorAll('.close-tab')) {
  b.addEventListener('click', () => {
    window.close();
    setTimeout(() => { location.href = './'; }, 200);
  });
}

// ------------------------------------------------------------------ page text from content/*.md
// Each file page's words live in a plain text file in content/ (the formatting is explained in
// content/README.md). This fetches the file, always checking for the newest version so edits
// show up straight away, and turns it into the page.
const main = document.querySelector('main[data-content]');
if (main) {
  main.setAttribute('aria-busy', 'true'); // tells screen readers the page is still being filled in
  fetch(main.dataset.content, { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then((text) => { main.innerHTML = renderPage(text); })
    .catch(() => { main.innerHTML = '<p>This file didn’t load. <a href="">Try again</a>.</p>'; })
    .finally(() => {
      main.removeAttribute('aria-busy');
      main.dataset.ready = '';
    });
}

// The formatting, line by line:
//   # Title                    the page title
//   ## Section                 a section heading
//   ### Name | Dates           an entry, with the dates in the left column ("### Name" for none)
//   **Role**                   a line that is all bold, inside an entry: a role title
//   - text                     a list item: a bullet inside an entry, a plain line under a section
//   1. text                    a numbered list item (2., 3. and so on follow on)
//   anything else              a paragraph (each line is its own; blank lines are just spacing)
// The first paragraph after the title is its introduction.
function renderPage(text) {
  const out = [];
  let list = '';      // the list being written: 'bullets' (in an entry), 'lines' (under a section) or 'numbers'
  let block = '';     // the entry being written: 'entry' (with dates) or 'item' (without)
  let intro = false;  // true right after the title
  const endList = () => {
    if (list) out.push(list === 'numbers' ? '</ol>' : '</ul>');
    list = '';
  };
  const endBlock = () => {
    endList();
    if (block === 'entry') out.push('</div></div>');
    else if (block === 'item') out.push('</div>');
    block = '';
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const [, marks, words] = heading;
      endBlock();
      intro = marks === '#';
      if (marks === '#') out.push(`<h1>${inline(words)}</h1>`);
      else if (marks === '##') out.push(`<h2>${inline(words)}</h2>`);
      else {
        const cut = words.lastIndexOf(' | ');
        const name = cut < 0 ? words : words.slice(0, cut);
        const when = cut < 0 ? '' : words.slice(cut + 3);
        if (when) {
          out.push(`<div class="entry"><div class="when">${inline(when)}</div><div class="what">`);
          block = 'entry';
        } else {
          out.push('<div class="item">');
          block = 'item';
        }
        out.push(`<h3 class="org">${inline(name)}</h3>`);
      }
      continue;
    }

    const item = line.match(/^-\s+(.+)$/);
    if (item) {
      const kind = block ? 'bullets' : 'lines';
      if (list !== kind) {
        endList();
        out.push(kind === 'lines' ? '<ul class="refs" role="list">' : '<ul>'); // role: Safari's screen reader forgets a list is a list once its bullets are styled away
        list = kind;
      }
      out.push(`<li>${inline(item[1])}</li>`);
      intro = false;
      continue;
    }

    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      if (list !== 'numbers') {
        endList();
        const start = Number(numbered[1]);
        out.push(start === 1 ? '<ol>' : `<ol start="${start}">`);
        list = 'numbers';
      }
      out.push(`<li>${inline(numbered[2])}</li>`);
      intro = false;
      continue;
    }

    endList();
    if (block && /^\*\*[^*]+\*\*$/.test(line)) {
      out.push(`<p class="role">${inline(line.slice(2, -2))}</p>`);
      continue;
    }
    const kind = intro ? 'lede' : EMAIL_ONLY.test(line) ? 'email-box' : '';
    intro = false;
    out.push(`<p${kind ? ` class="${kind}"` : ''}>${inline(line)}</p>`);
  }
  endBlock();
  return out.join('\n');
}

// An address written as a puzzle ("first[at]domain[dot]tld", with or without spaces) on a line of its
// own is shown large. It stays exactly as written: it is never turned into a real address or a link,
// so only a person who can work it out can use it.
const EMAIL_ONLY = /^[\w.+-]+ ?\[at\] ?[\w-]+(?: ?\[dot\] ?[\w-]+)+$/;

// Within a line: **bold**, *italics* and [link text](address). Everything else shows exactly as
// written, including anything that looks like HTML.
function inline(text) {
  const links = [];
  const s = escapeHtml(text).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, words, url) => {
    links.push(`<a href="${safeUrl(url)}">${styled(words)}</a>`);
    return `\u0000${links.length - 1}\u0000`;
  });
  return styled(s).replace(/\u0000(\d+)\u0000/g, (_, i) => links[i]);
}

function styled(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\d+–\d+/g, '<span class="nowrap">$&</span>'); // keep number ranges like 430–44 together
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Links may go to web pages, email addresses, or pages on this site; anything else goes nowhere.
function safeUrl(url) {
  return /^(https?:\/\/|mailto:|#|\.{0,2}\/|[\w-]+\.html\b)/i.test(url) ? url : '#';
}
