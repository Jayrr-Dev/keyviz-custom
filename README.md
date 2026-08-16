# [Keyviz](https://keyviz.org)

<div>
   <img src="https://img.shields.io/github/v/release/mulaRahul/keyviz?style=flat-square" alt="Releases">
   <img src="https://img.shields.io/github/downloads/mulaRahul/keyviz/total?style=flat-square" alt="Downloads">
   <img src="https://img.shields.io/github/stars/mulaRahul/keyviz?style=flat-square" alt="Stars">
   <img src="https://img.shields.io/github/license/mulaRahul/keyviz?style=flat-square" alt="License">
   <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey?style=flat-square" alt="Platform Support">
</div>

Keyviz is a **free and open-source** tool that visualizes your keypresses and mouse actions in real-time. Let your audience know what handy shortcuts you're pressing during tutorials, presentations, collaborations, or whenever you need.

## ⌨️ Keypress & 🖱️ Mouse Actions
Along with normal keys, you can also visualize mouse actions like <kbd>Cmd</kbd> + <kbd>Click</kbd>, <kbd>Alt</kbd> + <kbd>Drag</kbd>, etc.

<img src="previews/visualization.png" alt="Keystroke Visualization" width="450">

Display mouse clicks and scroll wheel movements alongside your cursor.

<img src="previews/mouse-indicator.gif" alt="Mouse Indicator" width="450">

</br>

## ⚙️ Full Customization
Don't settle for defaults. Every aspect of the visualization is under your control:
- **Styling:** Change colors (modifier vs. regular keys), size, layout, border, and background.
- **Filtering:** Control which keys are shown using hotkey or custom filters.
- **History:** Keep a visual trail of your recent inputs.
- **Position:** Move the visualization to any part of your screen.
- **Animations:** Customize how inputs appear and disappear with preset entry and exit animations.

</br>

<img src="previews/settings.png" alt="Settings Panel" width="600">

</br>

## 📥 Installation

### Windows & macOS
You can download the latest version of Keyviz from the **[GitHub Releases](https://github.com/mulaRahul/keyviz/releases)** page.

*   **Windows:** Download the `.msi` installer, run it, and follow the steps.
*   **macOS:** Download the `.dmg`. 
    **Note:** Keyviz requires **Input Monitoring** and **Accessibility** permissions. Enable them here:
    `Settings > Privacy & Security > Input Monitoring & Accessibility`

### Linux (x11)
Keyviz is compatible with Linux using the X11 protocol. Currently, you can try it out by following the build instructions below.

</br>

## 🛠️ Build Instructions

If you want to contribute or build the latest features from the source, ensure you have [Node.js](https://nodejs.org/) and [Tauri](https://v2.tauri.app/start) set up on your system.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/mulaRahul/keyviz.git
    cd keyviz
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the executable:**
    ```bash
    npx tauri build
    ```

<br/>


## 💖 Support the Project

*   **Star the Repo:** It helps others discover the project!
*   **GitHub Sponsors:** [Sponsor @mularahul](https://github.com/sponsors/mulaRahul)
*   **Keyviz Pro:** Get access to exclusive features while supporting the development of this open-source project.

👉 **[Upgrade to Pro at keyviz.org/pro](https://keyviz.org/pro)**

</br>

---

  Built with 🦀 and ❤️ using <a href="https://v2.tauri.app/">Tauri</a>.

---

## Keyviz Stream

This repo is a fork of [Keyviz](https://github.com/mulaRahul/keyviz) by Rahul Mula. The Stream build (v2.2.0) is aimed at classrooms and live streams. Upstream Keyviz still lives at [keyviz.org](https://keyviz.org).

<img src="public/logo.svg" alt="Keyviz Stream icon" width="64">

Windows installers are on the [v2.2.0 release](https://github.com/Jayrr-Dev/keyviz-custom/releases/tag/v2.2.0):

- `Keyviz Stream_2.2.0_x64-setup.exe`
- `Keyviz Stream_2.2.0_x64_en-US.msi`

To build from this fork:

```bash
git clone https://github.com/Jayrr-Dev/keyviz-custom.git
cd keyviz-custom
npm install
npx tauri build
```

### Draw mode

`Ctrl+Alt+D` turns on an overlay you can ink on. The toolbar has pen, arrow, square, circle, select and move, plus color swatches and stroke size. Middle click is a laser (same fading streak as the eraser, no wipe). Right click erases. Escape or `Ctrl+Alt+D` leaves. Toolbar placement (alignment, offset, horizontal or vertical) is under Draw Mode in settings.

<img src="previews/draw-toolbar.png" alt="Draw mode toolbar" width="700">

<img src="previews/draw-mode-settings.png" alt="Draw Mode settings" width="520">

### Mouse hold shapes

Each mouse button can use its own hold ring: circle, triangle, or square. Left, middle, and right are set separately under Mouse, Hold Shape. Changing a dropdown flashes that shape on the cursor.

<img src="previews/hold-shape.png" alt="Hold Shape settings for left, middle, and right" width="520">

<img src="previews/mouse-settings.png" alt="Mouse settings with click highlight" width="600">

### Hotkey labels

The Cursor set now names `Ctrl+T` (new chat tab) and `Ctrl+Shift+M` (full screen). The default set names `Win+Shift+S` as Screenshot.

<img src="previews/screenshot-shortcut.png" alt="Win Shift S key overlay" width="450">

