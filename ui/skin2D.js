class Skin2D {
    async getHead(skinSource) {
        let image = await this._loadImage(skinSource);
        return await new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');

            // Disable image smoothing for pixel-perfect head
            ctx.imageSmoothingEnabled = false;

            // Draw Base Head (8, 8, 8, 8)
            ctx.drawImage(image, 8, 8, 8, 8, 0, 0, 64, 64);

            // Draw Hat Layer (40, 8, 8, 8) - Overlays on base head
            ctx.drawImage(image, 40, 8, 8, 8, 0, 0, 64, 64);

            resolve(canvas.toDataURL());
        });
    }

    _loadImage(src) {
        return new Promise((resolve, reject) => {
            if (src.startsWith('http') && !src.includes('localhost')) {
                // For remote URLs, we might need a proxy or handle CORS
                // But generally, skin APIs allow CORS.
            }
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = src;
        });
    }
}

if (typeof module !== 'undefined') {
    module.exports = Skin2D;
} else {
    window.Skin2D = Skin2D;
}
