import { Show, createSignal } from 'solid-js'
import DocumentDetector from '../DocumentDetector'
import CameraFeed from './CameraFeed';
import './Scanner.css'
import { Point } from 'opencv-ts';
import THREE from 'three'
import cv from 'opencv-ts'
export default function Scanner(props) {
    let tlRef, trRef, brRef, blRef, canvasRef, canvasRef2;
    const [status, setStatus] = createSignal("");
    const [debugText, setDebugText] = createSignal("");
    const detector = new DocumentDetector();
    const [corners, setCorners] = createSignal<Point[]>([]);
    const scan = async (imageSource: string, imageCanvas: HTMLCanvasElement) => {
        const cx = await detector.findDocumentCorners(imageSource);
        if (cx) {
            const points = [
                [cx[0].x, cx[0].y], // Top-left
                [cx[1].x, cx[1].y], // Top-right
                [cx[3].x, cx[3].y], // Bottom-right
                [cx[2].x, cx[2].y], // Bottom-left
            ];
            setCorners(cx);
            setStatus("Document corners found");
            tlRef.style.display = 'block';
            tlRef.style.left = `${cx[0].x}px`;
            tlRef.style.top = `${cx[0].y}px`;
            trRef.style.display = 'block';
            trRef.style.left = `${cx[1].x}px`;
            trRef.style.top = `${cx[1].y}px`;
            brRef.style.display = 'block';
            brRef.style.left = `${cx[3].x}px`;
            brRef.style.top = `${cx[3].y}px`;
            brRef.style.display = 'block';
            blRef.style.left = `${cx[2].x}px`;
            blRef.style.top = `${cx[2].y}px`;
            const targetWidth = detector.alignedImageWidth;
            const targetHeight = detector.alignedImageHeight;
            canvasRef.style.width = targetWidth + 'px';
            canvasRef.style.height = targetHeight + 'px';
            setDebugText(JSON.stringify(cx, null, 4));
            cv.imshow(canvasRef, detector.alignedImageMat);

            //drawAlignedImage();


        } else {
            setStatus("No document corners found");
        }
    }
    // const scan = async() => {}


    return (
        <div>
            <div style='display: flex; flex-direction: row;'>
                <div class="scanner" style='display: flex; width: 30em; height: 15em;'>
                    <CameraFeed onImage={scan}>
                        {({ captureImage }) => (
                            <>
                                <div ref={tl => tlRef = tl} class="scanner-corner tl"></div>
                                <div ref={tr => trRef = tr} class="scanner-corner tr"></div>
                                <div ref={br => brRef = br} class="scanner-corner br"></div>
                                <div ref={bl => blRef = bl} class="scanner-corner bl"></div>

                                <div style='position: absolute; bottom: 0px; height: 5em; width: 100%; left: 0px; display:none;'>
                                    <button onClick={captureImage}>Capture Image</button>
                                </div>
                            </>
                        )}
                    </CameraFeed>
                </div>
                <canvas ref={canvas => canvasRef = canvas} style="width: 20em; height: 15em; border: 1px solid #f0f;" />
            </div>
                <div style=''>
                    <Show when={debugText()}>
                        <pre>{debugText()}</pre>
                    </Show>
                </div>

        </div>
    );
}
