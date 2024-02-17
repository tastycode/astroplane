import { createSignal, onCleanup, createEffect, Show } from 'solid-js';

const CameraFeed = (props) => {
  let videoRef;
  let canvasRef;

  const [stream, setStream] = createSignal(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef) videoRef.srcObject = mediaStream;
    } catch (err) {
      console.error("Error accessing the camera: ", err);
    }
  };

  const captureImage = () => {
    const canvas = canvasRef
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (context && videoRef) {
      canvas.width = videoRef.videoWidth;
      canvas.height = videoRef.videoHeight;
      context.drawImage(videoRef, 0, 0, videoRef.videoWidth, videoRef.videoHeight);
      const imageData = canvas.toDataURL('image/png');
      // Pass the captured image data to the parent component or handler
      props.onImage?.(imageData, canvasRef);
    }
  };
  setInterval(() => captureImage(), 1000);

  onCleanup(() => {
    const mediaStream = stream();
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
  });

  // Use children as a function to pass down the captureImage method
  const childrenWithProps = () => {
    if (typeof props.children === 'function') {
      return props.children({ captureImage });
    }
    return props.children;
  };

  createEffect(() => {
    startCamera();
  });

  return (
    <div style='position: relative;display: flex; border: 1px solid #0f0;'>
      <Show when={stream()}>
        <video ref={videoRef} autoplay playsinline style="position: absolute; top: 0px; left: 0px; right: 0px; bottom: 0px; "></video>
          <canvas ref={canvas => (canvasRef = canvas)}  style="position: absolute; top: 0; left: 0px; right: 0px; bottom: 0; display: none; "></canvas>
          {childrenWithProps()}
      </Show>
      <Show when={!stream()}>
        <button onClick={startCamera}>Start Camera</button>

      </Show>


    </div>
  );
};

export default CameraFeed;