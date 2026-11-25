// The four hidden pages, in the order the score bar shows them (the same order as the links beside
// the game). Rename them or change their files here.
// `pill` is the label printed on the falling capsule; `file` is the "file name" shown in the dialog.
export const PAGES = [
  { id: 'about',    file: 'ABOUT_ME.HTML', pill: 'ABOUT.HTM', hud: 'ABOUT', label: 'About',          desc: 'Who I am and what I do',        url: 'about.html' },
  { id: 'cv',       file: 'CV.PDF',        pill: 'CV.PDF',    hud: 'CV',    label: 'CV',             desc: 'Curriculum vitae',              url: 'cv.html' },
  { id: 'failures', file: 'FAILURES.TXT',  pill: 'FAIL.TXT',  hud: 'FAIL',  label: 'CV of Failures', desc: 'Everything that didn’t work', url: 'failures.html' },
  { id: 'contact',  file: 'CONTACT.VCF',   pill: 'CONTACT',   hud: 'MAIL',  label: 'Contact',        desc: 'How to reach me',               url: 'contact.html' },
];

export const STORAGE_KEY = 'bitstream.v1';
