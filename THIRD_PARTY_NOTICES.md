# Third-party notices and provenance

## React Bits DepthCarousel

- Source: https://reactbits.dev/r/DepthCarousel-JS-CSS.json
- Upstream: https://github.com/DavidHDev/react-bits
- Retrieved: 2026-10-23 (JS-CSS variant)
- Copyright: David Haz
- License: MIT + Commons Clause. See the upstream license below.
- Adaptations: symmetric cylindrical arc with vertical displacement and rotateY/rotateZ; HTML paper covers and detail-opening events; horizontal-only trackpad handling; drag-click suppression; localized controls; offscreen/document-hidden/reduced-motion autoplay handling. Default stock photos are not used.

React and React DOM are MIT licensed. GSAP is distributed under its Standard License:
https://gsap.com/community/standard-license/

The bundled production JavaScript retains license comments in its adjacent `.LEGAL.txt` file.

## Website typefaces

- Anthropic Serif: official Roman and Italic webfont files observed on https://claude.com/ on 2026-10-23, hosted unchanged for the site owner’s explicitly requested typography. Source URLs and SHA256 are retained in assets/fonts/provenance.json. Anthropic Serif is Anthropic’s brand typeface; no open-source license is asserted for these files.
- Noto Serif SC: Google Fonts / Noto CJK. Source: https://github.com/notofonts/noto-cjk . Distributed under the SIL Open Font License 1.1; served through Google Fonts.

## Wheel interaction reference

Motion reference: https://crl-2026.webflow.io/library (inspected 2026-10-24). The wheel input, circular orbit, inertia and snapping are independently implemented with DOM transforms and GSAP. No reference site images, copy, WebGL shaders or application bundle are included.

The exhibition layout, blended title treatment, and Wheel / List interaction refer to the same user-supplied CRL Library page. Implementation and paper-cover artwork are project code; no reference-site images, branding, text collection, or production bundle are included.
