# Editing the file pages

The words on the four "recovered file" pages live in these files:

- **CV**: `cv.md`
- **CV of Failures**: `failures.md`
- **About Me**: `about.md`
- **Contact Me**: `contact.md`

## Making a change

1. Click the file you want to change, for example `cv.md`.
2. Click the pencil icon (**Edit this file**) near the top right.
3. Change the words. The **Preview** tab gives a rough idea of how it will look.
4. Click **Commit changes…**, then **Commit changes** again. A short note like "Add 2026 talk" helps you find the change later, but the suggested one is fine too.
5. The live page updates in about a minute. Reload it to check.

If something comes out wrong, edit the file again. Or click **History** on the file to see every earlier version and copy back what you need.

## Formatting

- `# Title` is the page's big title (the first line of the file).
- `## Section` is a section heading. It shows in capitals in the pixel font, so type it normally.
- `### NAME | Dates` starts an entry, with the dates in the gold column on the left.
  - Leave off ` | Dates` for an entry without dates, like the coursework on the CV.
  - The name shows exactly as you type it: organisations are in capitals on the CV because they're typed that way.
- `**Role title**` on a line of its own, inside an entry, is a role (bold).
- `- Some text` is a list item. Inside an entry it's a bullet. Directly under a section heading it's a plain line with a hanging indent, like the publications.
- `**bold**`, `*italics*` and `[link text](https://example.org)` work anywhere.
- `name [at] oconnorv [dot] com` shows as a clickable email address. Written this way, spam bots can't easily read it from this file or the page.

Also:

- Each line is its own paragraph. Blank lines are just spacing, so use them freely.
- The first paragraph after the title is shown as a lighter introduction.
- Anything that looks like HTML shows as plain text, so you can't break the page layout by accident.
- Number ranges with an en dash, like `430–44`, are kept on one line.

## Example

```
## Professional Experience

### CHARLOTTE MECKLENBURG LIBRARY | 2020 – Present
**Robinson-Spangler Carolina Room Manager**
Direct strategy and vision for Archives and Special Collections...
- Supervise a team of 5 Librarians and Archivists...
- Implement archival request workflow software, Aeon

### BOSTON COLLEGE | 2017 – 2020
**Scholarly Communications Librarian**
Advised Boston College administration...
- Drafted licenses for acquisition and use of materials...

**Institutional Repository Librarian**
Managed Boston College's institutional repository...
- Implemented Scrum Project Management framework...
```

## What isn't in these files

The page headers ("RECOVERED FILE: CV.PDF"), the browser-tab titles, the game, and the design live in the site's code. Ask Claude for changes to those.
