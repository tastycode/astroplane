import cv, { type Mat, type Size, type Point } from 'opencv-ts'
import Utils from 'opencv-ts/src/core/Utils'

export default class DocumentDetector {
  public alignedImageMat: Mat
  public alignedImageWidth: number
  public alignedImageHeight: number
  
  // Function to find document corners from an image
  public async findDocumentCorners(image: HTMLImageElement | string): Promise<Point[] | null> {

    if (typeof image === 'string') {
      image = await this.base64ToImage(image)
    }
    // First, we convert the HTMLImageElement to OpenCV Mat
    let mat = cv.imread(image)

    // Resize image to make document corner detection easier
    const shrunkImageHeight = 500.0
    const scaleFactor = shrunkImageHeight / image.height
    const resizedWidth = image.width * scaleFactor
    const size = new cv.Size(resizedWidth, shrunkImageHeight)
    let resizedMat = new cv.Mat()
    cv.resize(mat, resizedMat, size, 0, 0, cv.INTER_LINEAR)

    // Convert image to LUV colorspace
    let luvMat = new cv.Mat()
    cv.cvtColor(resizedMat, luvMat, cv.COLOR_BGR2Luv);

    // Separate photo into L, U, V channels
    let channels = new cv.MatVector();
    cv.split(luvMat, channels);

    let documentCorners: Point[] | null = null;
    let maxArea = 0;

    // Find corners for each color channel
    for (let i = 0; i < channels.size(); i++) {
      const channelMat = channels.get(i);
      const corners = this.findCorners(channelMat);
      if (corners) {
        // Convert Point[] back to a Mat or MatVector for cv.contourArea
        let contourMat = new cv.Mat(corners.length, 1, cv.CV_32SC2);
        for (let i = 0; i < corners.length; i++) {
          contourMat.data32S[i * 2] = corners[i].x;
          contourMat.data32S[i * 2 + 1] = corners[i].y;
        }
      
        const area = cv.contourArea(contourMat);
        if (area > maxArea) {
          maxArea = area;
          // Scale points back to original image size
          documentCorners = corners.map(pt => new cv.Point(pt.x / scaleFactor, pt.y / scaleFactor));
        }
      
        contourMat.delete(); // Don't forget to clean up!
      }
     
    }

    // Sort and organize corners: top-left, top-right, bottom-left, bottom-right
    if (documentCorners) {
      documentCorners.sort((a, b) => a.y - b.y); // Sort by Y
      const topCorners = documentCorners.slice(0, 2).sort((a, b) => a.x - b.x);
      const bottomCorners = documentCorners.slice(2, 4).sort((a, b) => a.x - b.x);
      documentCorners = [...topCorners, ...bottomCorners];
      const [tl, tr, bl, br] = documentCorners;
      let widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
      let widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
      let theWidth = (widthBottom > widthTop) ? widthBottom : widthTop;
      let heightRight = Math.hypot(tr.x - br.x, tr.y - br.y);
      let heightLeft = Math.hypot(tl.x - bl.x, tr.y - bl.y);
      let theHeight = (heightRight > heightLeft) ? heightRight : heightLeft;

      let finalDestCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, theWidth - 1, 0, theWidth - 1, theHeight - 1, 0, theHeight - 1]); //
      let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
      let dsize = new cv.Size(theWidth, theHeight);
      let M = cv.getPerspectiveTransform(srcCoords, finalDestCoords)


      this.alignedImageMat = new cv.Mat(dsize.height, dsize.width, cv.CV_8UC3);
      cv.warpPerspective(mat, this.alignedImageMat, M, dsize, cv.INTER_AREA, cv.BORDER_ISOLATED, new cv.Scalar());





      //const {maxWidth, maxHeight } = this.calculateWidthHeight(documentCorners);
      this.alignedImageHeight = theHeight
      this.alignedImageWidth = theWidth;
      /*
      const destPoints = [
        { x: 0, y: 0 }, // Top-left
        { x: maxWidth - 1, y: 0 }, // Top-right
        { x: maxWidth - 1, y: maxHeight - 1 }, // Bottom-right
        { x: 0, y: maxHeight - 1 } // Bottom-left
      ];
      let srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, [].concat(...documentCorners));
      const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, [].concat(...destPoints));

      let M = cv.getPerspectiveTransform(srcMat, dstMat);
      const fourByFourMatrix = new cv.Mat(4, 4, cv.CV_32F);
      M.copyTo(fourByFourMatrix);
      cv.setIdentity(fourByFourMatrix,  new cv.Scalar(1.0));
      M.copyTo(fourByFourMatrix.rowRange(0,3).colRange(0,3));
      this.alignedImageMat = fourByFourMatrix
      //cv.warpPerspective(mat, this.alignedImageMat, M, dsize,cv.INTER_NEAREST, cv.BORDER_TRANSPARENT);
      */

      mat.delete();
      luvMat.delete();
      resizedMat.delete();
      channels.delete();
      //srcMat.delete();
      //dstMat.delete();
    }

    return documentCorners;
  }

  private async base64ToImage(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (error) => reject(error);
      img.src = base64;
    });
  }

  private calculateWidthHeight(corners: Point[]) {
    const [tl, tr, br, bl] = corners;

    const widthTop = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
    const widthBottom = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
    const maxWidth = Math.max(widthTop, widthBottom);

    const heightLeft = Math.sqrt(Math.pow(bl.x - tl.x, 2) + Math.pow(bl.y - tl.y, 2));
    const heightRight = Math.sqrt(Math.pow(br.x - tr.x, 2) + Math.pow(br.y - tr.y, 2));
    const maxHeight = Math.max(heightLeft, heightRight);
    return {maxWidth, maxHeight}
  }


  private findCorners(image: Mat): Point[] | null {
    let processedImage = new cv.Mat();
    
    // Blur image to reduce noise
    cv.GaussianBlur(image, processedImage, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    
    // Apply threshold
    cv.threshold(processedImage, processedImage, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    
    // Canny edge detection
    cv.Canny(processedImage, processedImage, 50, 200);
    
    // Morphological closing to close gaps
     let kernel = (cv.Mat.ones as any)(5, 5, cv.CV_8U);
     
    //let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));

    cv.morphologyEx(processedImage, processedImage, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());

    
    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(processedImage, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    
    let maxContour: Mat | null = null;
    let maxArea = 0;
    
    // Process each contour
    for (let i = 0; i < contours.size(); ++i) {
      let contour = contours.get(i);
      let approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * cv.arcLength(contour, true), true);

      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        let area = cv.contourArea(approx);
        if (area > 1000 && area > maxArea) {
          maxArea = area;
          if (maxContour) {
            maxContour.delete();
          }
          maxContour = approx;
        } else {
          approx.delete();
        }
      } else {
        approx.delete();
      }
    }

    let points: Point[] | null = null;
    if (maxContour) {
      points = [];
      for (let i = 0; i < maxContour.rows; ++i) {
        points.push(new cv.Point(maxContour.data32S[i * 2], maxContour.data32S[i * 2 + 1]));
      }
      maxContour.delete();
    }

    processedImage.delete();
    contours.delete();
    hierarchy.delete();

    return points;
  }
}