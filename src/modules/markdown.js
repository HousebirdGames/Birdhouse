export async function markdown(input) {
    let html = input;

    const boldPattern = /\[b\](.*?)\[\/b\]/g;
    const italicPattern = /\[i\](.*?)\[\/i\]/g;
    const underlinePattern = /\[u\](.*?)\[\/u\]/g;
    const headerPattern = /\[(h[1-6])\](.*?)\[\/\1\]/g;
    const imgPattern = /\[img src=\^(.*?)\^( alt=\^(.*?)\^)?( title=\^(.*?)\^)?( href=\^(.*?)\^)?\]/g;
    const brPattern = /\[br\]/g;
    const ulPattern = /\[ul\](.*?)\[\/ul\]/gs;
    const liPattern = /\[li\](.*?)\[\/li\]/g;
    const aPattern = /\[a href=\^(.*?)\^\](.*?)\[\/a\]/g;
    const pPattern = /\[p\](.*?)\[\/p\]/gs;
    const divPattern = /\[div class=\^(.*?)\^\](.*?)\[\/div\]/gs;
    const comparePattern = /\[compare src1=\^(.*?)\^ src2=\^(.*?)\^\]/g;
    const buttonPattern = /\[button href=\^(.*?)\^\](.*?)\[\/button\]/g;
    const buttonWrapPattern = /\[buttonWrap\](.*?)\[\/buttonWrap\]/gs;

    // Find all matches
    const ulMatches = Array.from(html.matchAll(ulPattern));
    const divMatches = Array.from(html.matchAll(divPattern));

    // Process matches asynchronously
    const ulPromises = ulMatches.map(match => markdown(match[1]));
    const divPromises = divMatches.map(match => markdown(match[2]));

    // Wait for all promises to resolve
    const ulResults = await Promise.all(ulPromises);
    const divResults = await Promise.all(divPromises);

    // Replace original matches with processed content
    ulMatches.forEach((match, index) => {
        html = html.replace(match[0], `<ul>${ulResults[index]}</ul>`);
    });
    divMatches.forEach((match, index) => {
        html = html.replace(match[0], `<div class="${match[1]}">${divResults[index]}</div>`);
    });

    html = await window.triggerHook('add-markdown-patterns', html);
    html = html.replace(boldPattern, "<strong>$1</strong>");
    html = html.replace(italicPattern, "<em>$1</em>");
    html = html.replace(underlinePattern, "<u>$1</u>");
    html = html.replace(headerPattern, "<$1>$2</$1>");
    html = html.replace(imgPattern, function (match, src, _, alt, __, title, ___, href) {
        alt = alt || src;
        title = title || src;
        if (href) {
            return `<a href="${href}"><img src="uploads/${src}" alt="${alt}" title="${title}" /></a>`;
        }
        return `<img src="uploads/${src}" alt="${alt}" title="${title}" loading="lazy"/>`;
    });
    html = html.replace(brPattern, "<br />");
    html = html.replace(liPattern, "<li><p>$1</p></li>");
    html = html.replace(aPattern, "<a href=\"$1\" class=\"underline noShift\">$2</a>");
    html = html.replace(pPattern, "<p>$1</p>");
    html = html.replace(comparePattern, function (match, src1, src2) {
        return `
            <div class="image-spliter">
            <div class="mover"></div>
                <img class="img-left" src="uploads/${src1}" alt="${src1} loading="lazy"">
                <img class="img-right" src="uploads/${src2}" alt="${src2} loading="lazy"">
            </div>
        `;
    });
    html = html.replace(buttonPattern, "<a href=\"$1\" class=\"button\">$2</a>");
    const buttonWrapMatches = Array.from(html.matchAll(buttonWrapPattern));
    const buttonWrapPromises = buttonWrapMatches.map(match => markdown(match[1]));
    const buttonWrapResults = await Promise.all(buttonWrapPromises);
    buttonWrapMatches.forEach((match, index) => {
        html = html.replace(match[0], `<div class="blogButtonWrap">${buttonWrapResults[index]}</div>`);
    });

    return html;
}

export const markdownElements = {
    'Paragraph': '[p]Paragraph[/p]',
    'Heading 1': '[h1]Heading[/h1]',
    'Heading 2': '[h2]Heading[/h2]',
    'Heading 3': '[h3]Heading[/h3]',
    'Heading 4': '[h4]Heading[/h4]',
    'Heading 5': '[h5]Heading[/h5]',
    'Heading 6': '[h6]Heading[/h6]',
    'Bold': '[b]bold[/b]',
    'Italic': '[i]italic[/i]',
    'Underline': '[u]underline[/u]',
    'Image': '[img src=^file^ alt=^^ title=^^ href=^^]',
    'Compare Images': '[compare src1=^image1^ src2=^image2^]',
    'Line Break': '[br]',
    'Unordered List': '[ul][/ul]',
    'List Item': '[li]Item[/li]',
    'Link': '[a href=^link^]text[/a]',
    'Div': '[div class=^^]Content[/div]',
    'Button': '[button href=^link^]Button Text[/button]',
    'Button Wrapper': '[buttonWrap][/buttonWrap]'
};