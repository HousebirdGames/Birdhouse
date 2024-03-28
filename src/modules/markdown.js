/* The Birdhdouse markdown module provides a function to transform custom Birdhouse markdown input into HTML, applying pattern replacements and preprocessing. */

/**
 * Defines markdown elements with their Birdhouse markdown representations.
 * Provides a mapping of common HTML elements to their Birdhouse markdown format for easy reference.
 * @type {Object<string, string>}
 */
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
    'Div': '[div class=^^ id=^^]Content[/div]',
    'Button': '[button href=^link^]Button Text[/button]',
    'Button Wrapper': '[buttonWrap][/buttonWrap]'
};

/**
 * Transforms custom Birdhouse markdown input into HTML, applying pattern replacements and preprocessing.
 * @param {string} input Birdhouse markdown input to be transformed.
 * @return {Promise<string>} The transformed HTML output.
 */
export async function markdown(input) {
    let html = input;

    html = await applyPatternReplacements(preprocessInput(html));

    return html;
}

//<
const boldPattern = /\[b(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\](.*?)\[\/b\]/g;
const italicPattern = /\[i(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\](.*?)\[\/i\]/g;
const underlinePattern = /\[u(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\](.*?)\[\/u\]/g;
const headerPattern = /\[(h[1-6])(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\](.*?)\[\/\1\]/g;
const imgPattern = /\[img src=\^(.*?)\^(?: alt=\^(.*?)\^)?(?: title=\^(.*?)\^)?(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\]/g;
const brPattern = /\[br(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\]/g;
const ulPattern = /\[ul(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\](.*?)\[\/ul\]/gs;
const liPattern = /\[li(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\](.*?)\[\/li\]/g;
const aPattern = /\[a href=\^(.*?)\^(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\](.*?)\[\/a\]/g;
const pPattern = /\[p(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\](.*?)\[\/p\]/gs;
const divPattern = /\[div(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\](.*?)\[\/div\]/gs;
const comparePattern = /\[compare src1=\^(.*?)\^ src2=\^(.*?)\^(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\]/g;
const buttonPattern = /\[button href=\^(.*?)\^(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\](.*?)\[\/button\]/g;
const buttonWrapPattern = /\[buttonWrap(?: class=\^(.*?)\^)?(?: id=\^(.*?)\^)?\](.*?)\[\/buttonWrap\]/gs;
//>

/**
 * Preprocesses the input string to remove empty attributes for easier pattern matching.
 * @param {string} input The input string with custom markdown.
 * @returns {string} The processed string with empty attributes removed.
 */
function preprocessInput(input) {
    return input.replace(/(?: alt=\^\^)?(?: title=\^\^)?(?: href=\^\^)?(?: src=\^\^)?(?: src1=\^\^)?(?: src2=\^\^)?/g, '');
}

/**
 * Formats class and ID attributes for HTML elements.
 * @param {string|null} clazz The class attribute value.
 * @param {string|null} id The ID attribute value.
 * @returns {string} Formatted class and ID attributes for inclusion in an HTML tag.
 */
function formatAttributes(clazz, id) {
    let classAttr = clazz ? ` class="${clazz}"` : '';
    let idAttr = id ? ` id="${id}"` : '';
    return `${classAttr}${idAttr}`;
}

/**
 * Applies pattern replacements to convert custom markdown into HTML, supporting optional classes and IDs.
 * This is also where the custom patterns from the `add-markdown-patterns` hook are applied.
 * @param {string} html The HTML string with custom markdown patterns.
 * @returns {string} The HTML string with markdown patterns replaced.
 */
async function applyPatternReplacements(html) {
    html = await window.triggerHook('add-markdown-patterns', html);
    html = html.replace(boldPattern, (match, clazz, id, content) => `<strong${formatAttributes(clazz, id)}>${content}</strong>`);
    html = html.replace(italicPattern, (match, clazz, id, content) => `<em${formatAttributes(clazz, id)}>${content}</em>`);
    html = html.replace(underlinePattern, (match, clazz, id, content) => `<u${formatAttributes(clazz, id)}>${content}</u>`);
    html = html.replace(headerPattern, (match, level, clazz, id, content) => `<${level}${formatAttributes(clazz, id)}>${content}</${level}>`);
    html = html.replace(brPattern, (match, clazz, id) => `<br${formatAttributes(clazz, id)} />`);
    html = html.replace(pPattern, (match, clazz, id, content) => `<p${formatAttributes(clazz, id)}>${content}</p>`);
    html = html.replace(liPattern, (match, clazz, id, content) => `<li${formatAttributes(clazz, id)}>${content}</li>`);
    html = html.replace(ulPattern, (match, clazz, id, content) => `<ul${formatAttributes(clazz, id)}>${content}</ul>`);
    html = html.replace(divPattern, (match, clazz, id, content) => `<div${formatAttributes(clazz, id)}>${content}</div>`);

    html = replaceComplexPatterns(html);

    return html;
}

/**
 * Handles replacement of complex patterns such as images, image comparison, buttons, and button wraps.
 * @param {string} html The HTML string to process.
 * @returns {string} The HTML string with complex markdown patterns replaced.
 */
function replaceComplexPatterns(html) {
    html = html.replace(imgPattern, (match, src, alt, title, clazz, id) => {
        let imgTag = `<img src="uploads/${src}" alt="${alt || src}" title="${title || src}"${formatAttributes(clazz, id)} loading="lazy"/>`;
        return imgTag;
    });

    html = html.replace(comparePattern, (match, src1, src2, clazz, id) => {
        return `
            <div class="image-spliter"${formatAttributes(clazz, id)}>
                <div class="mover"></div>
                <img class="img-left" src="${src1}" alt="Image 1" loading="lazy">
                <img class="img-right" src="${src2}" alt="Image 2" loading="lazy">
            </div>
        `;
    });

    html = html.replace(buttonPattern, (match, href, clazz, id, content) => {
        return `<a href="${href}" class="button${clazz ? ` ${clazz}` : ''}"${id ? ` id="${id}"` : ''}>${content}</a>`;
    });

    html = html.replace(buttonWrapPattern, async (match, clazz, id, content) => {
        const processedContent = await markdown(content); // Recursively process markdown inside the buttonWrap
        return `<div class="blogButtonWrap"${formatAttributes(clazz, id)}>${processedContent}</div>`;
    });

    html = html.replace(aPattern, (match, href, clazz, id, content) => `<a href="${href}"${formatAttributes(clazz, id)}>${content}</a>`);

    return html;
}