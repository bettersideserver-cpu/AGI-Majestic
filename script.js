class ScrollVideoSection {
  constructor(section) {
    this.section = section;
    this.canvas = section.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");

    this.src = section.dataset.video;
    this.duration = Number(section.dataset.duration || 0);
    this.fps = Number(section.dataset.fps || 60);
    this.sampleEvery = Number(section.dataset.sample || 2);

    // ✅ intro only
    this.autoplaySeconds = Number(section.dataset.autoplay || 0);
    this.isIntro = this.autoplaySeconds > 0;

    this.totalFrames = Math.floor((this.duration * this.fps) / this.sampleEvery);

    this.frames = [];
    this.ready = false;

    this.resize = this.resize.bind(this);
    this.onScroll = this.onScroll.bind(this);

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener("resize", this.resize);

    if (this.isIntro) {
      // ✅ INTRO mode = 2 videos (playback + extractor)
      this.videoPlayback = this.section.querySelector("video.playback");
      this.videoExtractor = this.section.querySelector("video.extractor");

      if (!this.videoPlayback || !this.videoExtractor) {
        console.error("Intro section needs 2 videos: .playback + .extractor");
        return;
      }

      this.setupVideo(this.videoPlayback);
      this.setupVideo(this.videoExtractor);

      this.videoPlayback.src = this.src;
      this.videoExtractor.src = this.src;

      this.videoPlayback.load();
      this.videoExtractor.load();

      this.videoExtractor.addEventListener("loadeddata", async () => {
        // ✅ extract frames first
        await this.extractFrames(this.videoExtractor);

        this.ready = true;

        // ✅ autoplay on canvas
        await this.playIntroOnCanvas(this.videoPlayback, this.autoplaySeconds);

        // ✅ enable scroll after autoplay
        this.onScroll();
        window.addEventListener("scroll", this.onScroll);
      });

    } else {
      // ✅ NORMAL mode = 1 video only
      this.video = this.section.querySelector("video");

      if (!this.video) {
        console.error("Normal scroll section needs 1 <video> tag");
        return;
      }

      this.setupVideo(this.video);

      this.video.src = this.src;
      this.video.load();

      this.video.addEventListener("loadeddata", async () => {
        await this.extractFrames(this.video);
        this.ready = true;
        this.drawFrame(0);

        window.addEventListener("scroll", this.onScroll);
      });
    }
  }

  setupVideo(video) {
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = "100vw";
    this.canvas.style.height = "100vh";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  async playIntroOnCanvas(video, seconds) {
    try {
      await video.play();
    } catch (e) {
      console.log("Intro autoplay blocked");
      return;
    }

    const start = performance.now();

    return new Promise(resolve => {
      const draw = () => {
        const elapsed = (performance.now() - start) / 1000;

        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        this.ctx.drawImage(video, 0, 0, window.innerWidth, window.innerHeight);

        if (elapsed >= seconds) {
          video.pause();
          resolve();
          return;
        }

        requestAnimationFrame(draw);
      };

      requestAnimationFrame(draw);
    });
  }

  async extractFrames(videoElement) {
    this.frames.length = 0;

    for (let i = 0; i < this.totalFrames; i++) {
      const t = (i * this.sampleEvery) / this.fps;

      await new Promise(resolve => {
        const onSeek = () => {
          videoElement.removeEventListener("seeked", onSeek);
          resolve();
        };
        videoElement.addEventListener("seeked", onSeek);
        videoElement.currentTime = t;
      });

      const bmp = await createImageBitmap(videoElement);
      this.frames.push(bmp);
    }
  }

  onScroll() {
    if (!this.ready) return;

    const scrollTop = window.scrollY;
    const sectionTop = this.section.offsetTop;
    const scrollLength = this.section.offsetHeight - window.innerHeight;

    const progress = Math.min(
      Math.max((scrollTop - sectionTop) / scrollLength, 0),
      1
    );

    // ✅ intro scroll starts after autoplay frame offset
    let startFrame = 0;
    if (this.isIntro) {
      startFrame = Math.floor((this.autoplaySeconds * this.fps) / this.sampleEvery);
      startFrame = Math.min(Math.max(startFrame, 0), this.frames.length - 1);
    }

    const remainingFrames = (this.frames.length - 1) - startFrame;
    const index = startFrame + Math.floor(progress * remainingFrames);

    this.drawFrame(index);
  }

  drawFrame(index) {
    const frame = this.frames[index];
    if (!frame) return;

    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    this.ctx.drawImage(frame, 0, 0, window.innerWidth, window.innerHeight);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".scroll-video").forEach(section => {
    new ScrollVideoSection(section);
  });
});
