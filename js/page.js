// Shared script for the content pages.

// [CLOSE TAB] closes this tab and drops the visitor back on the paused game.
// If the browser won't let a script close the tab (e.g. the page was opened directly), go home instead.
for (const b of document.querySelectorAll('.close-tab')) {
  b.addEventListener('click', () => {
    window.close();
    setTimeout(() => { location.href = './'; }, 200);
  });
}

// Email addresses are assembled here instead of written in the HTML, to slow down scrapers.
for (const el of document.querySelectorAll('[data-email-user]')) {
  const addr = `${el.dataset.emailUser}@${el.dataset.emailDomain}`;
  const a = document.createElement('a');
  a.href = `mailto:${addr}`;
  a.textContent = addr;
  el.replaceChildren(a);
}
