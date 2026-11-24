use serde::Deserialize;
use std::io::{Cursor, Write};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EpubChapterInput {
    pub id: String,
    pub title: String,
    pub part_title: String,
    pub xhtml_body: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EpubExportPayload {
    pub book_id: String,
    pub title: String,
    pub subtitle: String,
    pub author: String,
    pub language: String,
    pub dedication: String,
    pub copyright_notice: String,
    #[serde(default)]
    pub credits_xhtml: String,
    #[serde(default)]
    pub cover_image_png_base64: Option<String>,
    pub stylesheet: String,
    pub chapters: Vec<EpubChapterInput>,
}

fn decode_base64(input: &str) -> Option<Vec<u8>> {
    fn val(b: u8) -> Option<u32> {
        match b {
            b'A'..=b'Z' => Some((b - b'A') as u32),
            b'a'..=b'z' => Some((b - b'a' + 26) as u32),
            b'0'..=b'9' => Some((b - b'0' + 52) as u32),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }
    let clean: Vec<u8> = input
        .bytes()
        .filter(|b| !b.is_ascii_whitespace())
        .collect();
    if clean.is_empty() || clean.len() % 4 != 0 {
        return None;
    }
    let mut out = Vec::with_capacity((clean.len() / 4) * 3);
    for chunk in clean.chunks_exact(4) {
        let a = val(chunk[0])?;
        let b = val(chunk[1])?;
        let c = if chunk[2] == b'=' { 0 } else { val(chunk[2])? };
        let d = if chunk[3] == b'=' { 0 } else { val(chunk[3])? };
        let n = (a << 18) | (b << 12) | (c << 6) | d;
        out.push(((n >> 16) & 0xff) as u8);
        if chunk[2] != b'=' {
            out.push(((n >> 8) & 0xff) as u8);
        }
        if chunk[3] != b'=' {
            out.push((n & 0xff) as u8);
        }
    }
    Some(out)
}

pub fn escape_xml(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(ch),
        }
    }
    out
}

pub fn sanitize_filename(name: &str, fallback: &str) -> String {
    let clean: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = clean.trim().trim_matches('.');
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn build_epub_bytes(payload: &EpubExportPayload) -> Result<Vec<u8>, String> {
    let cursor = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(cursor);

    let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    let deflated = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    // EPUB 3 OCF requirement: `mimetype` must be the first entry and stored uncompressed
    zip.start_file("mimetype", stored)
        .map_err(|e| format!("ZIP mimetype error: {e}"))?;
    zip.write_all(b"application/epub+zip")
        .map_err(|e| format!("ZIP mimetype write error: {e}"))?;

    let container_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"#;
    zip.start_file("META-INF/container.xml", deflated)
        .map_err(|e| format!("ZIP container error: {e}"))?;
    zip.write_all(container_xml.as_bytes())
        .map_err(|e| format!("ZIP container write error: {e}"))?;

    zip.start_file("OEBPS/styles.css", deflated)
        .map_err(|e| format!("ZIP styles error: {e}"))?;
    zip.write_all(payload.stylesheet.as_bytes())
        .map_err(|e| format!("ZIP styles write error: {e}"))?;

    let title_esc = escape_xml(&payload.title);
    let subtitle_esc = escape_xml(&payload.subtitle);
    let author_esc = escape_xml(&payload.author);
    let lang_esc = escape_xml(if payload.language.trim().is_empty() {
        "en"
    } else {
        &payload.language
    });
    let book_uid = escape_xml(&format!("urn:quillvibe:{}", payload.book_id));

    let titlepage_xhtml = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="{lang_esc}">
<head>
  <meta charset="UTF-8"/>
  <title>{title_esc}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body class="front-matter">
  <section class="title-page">
    <h1 class="book-title">{title_esc}</h1>
    <p class="book-subtitle">{subtitle_esc}</p>
    <p class="book-author">{author_esc}</p>
  </section>
  <section class="copyright-page">
    <p class="dedication">{}</p>
    <p class="copyright">{}</p>
    {}
  </section>
</body>
</html>
"#,
        escape_xml(&payload.dedication),
        escape_xml(&payload.copyright_notice),
        payload.credits_xhtml,
    );
    zip.start_file("OEBPS/titlepage.xhtml", deflated)
        .map_err(|e| format!("ZIP titlepage error: {e}"))?;
    zip.write_all(titlepage_xhtml.as_bytes())
        .map_err(|e| format!("ZIP titlepage write error: {e}"))?;

    let mut manifest_items = String::from(
        "    <item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/>\n    <item id=\"css\" href=\"styles.css\" media-type=\"text/css\"/>\n",
    );
    let mut spine_items = String::new();
    let mut nav_links = String::new();

    if let Some(ref b64) = payload.cover_image_png_base64 {
        if let Some(png_bytes) = decode_base64(b64) {
            zip.start_file("OEBPS/cover.png", deflated)
                .map_err(|e| format!("ZIP cover.png error: {e}"))?;
            zip.write_all(&png_bytes)
                .map_err(|e| format!("ZIP cover.png write error: {e}"))?;

            let cover_xhtml = format!(
                r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="{lang_esc}">
<head>
  <meta charset="UTF-8"/>
  <title>Cover</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body class="cover-wrap">
  <img src="cover.png" alt="{title_esc}"/>
</body>
</html>
"#
            );
            zip.start_file("OEBPS/cover.xhtml", deflated)
                .map_err(|e| format!("ZIP cover.xhtml error: {e}"))?;
            zip.write_all(cover_xhtml.as_bytes())
                .map_err(|e| format!("ZIP cover.xhtml write error: {e}"))?;

            manifest_items.push_str(
                "    <item id=\"cover-img\" href=\"cover.png\" media-type=\"image/png\" properties=\"cover-image\"/>\n    <item id=\"cover\" href=\"cover.xhtml\" media-type=\"application/xhtml+xml\"/>\n",
            );
            spine_items.push_str("    <itemref idref=\"cover\"/>\n");
            nav_links.push_str("      <li><a href=\"cover.xhtml\">Cover</a></li>\n");
        }
    }

    manifest_items.push_str(
        "    <item id=\"titlepage\" href=\"titlepage.xhtml\" media-type=\"application/xhtml+xml\"/>\n",
    );
    spine_items.push_str("    <itemref idref=\"titlepage\"/>\n");
    nav_links.push_str("      <li><a href=\"titlepage.xhtml\">Title Page</a></li>\n");

    for (idx, ch) in payload.chapters.iter().enumerate() {
        let num = idx + 1;
        let href = format!("chapter-{num:03}.xhtml");
        let item_id = format!("chap-{num:03}");
        let ch_title_esc = escape_xml(&ch.title);
        let ch_id_esc = escape_xml(&ch.id);
        let ch_part_esc = escape_xml(&ch.part_title);

        let chapter_xhtml = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="{lang_esc}">
<head>
  <meta charset="UTF-8"/>
  <title>{ch_title_esc}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body id="{ch_id_esc}" data-part="{ch_part_esc}">
{}
</body>
</html>
"#,
            ch.xhtml_body
        );

        zip.start_file(format!("OEBPS/{href}"), deflated)
            .map_err(|e| format!("ZIP chapter error: {e}"))?;
        zip.write_all(chapter_xhtml.as_bytes())
            .map_err(|e| format!("ZIP chapter write error: {e}"))?;

        manifest_items.push_str(&format!(
            "    <item id=\"{item_id}\" href=\"{href}\" media-type=\"application/xhtml+xml\"/>\n"
        ));
        spine_items.push_str(&format!("    <itemref idref=\"{item_id}\"/>\n"));
        nav_links.push_str(&format!("      <li><a href=\"{href}\">{ch_title_esc}</a></li>\n"));
    }

    let nav_xhtml = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="{lang_esc}">
<head>
  <meta charset="UTF-8"/>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
{nav_links}    </ol>
  </nav>
</body>
</html>
"#
    );
    zip.start_file("OEBPS/nav.xhtml", deflated)
        .map_err(|e| format!("ZIP nav error: {e}"))?;
    zip.write_all(nav_xhtml.as_bytes())
        .map_err(|e| format!("ZIP nav write error: {e}"))?;

    let opf = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">{book_uid}</dc:identifier>
    <dc:title>{title_esc}</dc:title>
    <dc:creator>{author_esc}</dc:creator>
    <dc:language>{lang_esc}</dc:language>
    <meta property="dcterms:modified">2026-11-22T00:00:00Z</meta>
  </metadata>
  <manifest>
{manifest_items}  </manifest>
  <spine>
{spine_items}  </spine>
</package>
"#
    );
    zip.start_file("OEBPS/content.opf", deflated)
        .map_err(|e| format!("ZIP opf error: {e}"))?;
    zip.write_all(opf.as_bytes())
        .map_err(|e| format!("ZIP opf write error: {e}"))?;

    let finished = zip
        .finish()
        .map_err(|e| format!("ZIP finish error: {e}"))?;
    Ok(finished.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use zip::ZipArchive;

    #[test]
    fn builds_valid_epub_with_uncompressed_mimetype_first() {
        let payload = EpubExportPayload {
            book_id: "b1".into(),
            title: "The Salt & Glass".into(),
            subtitle: "Tides".into(),
            author: "M. Author".into(),
            language: "en".into(),
            dedication: "For readers".into(),
            copyright_notice: "Copyright 2026".into(),
            credits_xhtml: "<p class=\"credit-line\">Proofreader: A. Lind</p>".into(),
            cover_image_png_base64: Some("iVBORw0KGgo=".into()),
            stylesheet: "body { font-family: serif; }".into(),
            chapters: vec![EpubChapterInput {
                id: "c1".into(),
                title: "Chapter I".into(),
                part_title: "Part I".into(),
                xhtml_body: "<section><h2>Chapter I</h2><p>Hello sea.</p></section>".into(),
            }],
        };

        let bytes = build_epub_bytes(&payload).expect("epub builds");
        let mut archive = ZipArchive::new(Cursor::new(bytes)).expect("valid zip");
        assert!(archive.len() >= 6);

        let mut first = archive.by_index(0).expect("first entry");
        assert_eq!(first.name(), "mimetype");
        assert_eq!(first.compression(), CompressionMethod::Stored);
        let mut content = String::new();
        first.read_to_string(&mut content).expect("read mimetype");
        assert_eq!(content, "application/epub+zip");
        drop(first);

        let mut opf = archive.by_name("OEBPS/content.opf").expect("opf exists");
        let mut opf_str = String::new();
        opf.read_to_string(&mut opf_str).expect("read opf");
        assert!(opf_str.contains("The Salt &amp; Glass"));
        assert!(opf_str.contains("chapter-001.xhtml"));
    }
}
