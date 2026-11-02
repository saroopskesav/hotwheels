"use client";

import { motion } from "framer-motion";
import { Barcode, Camera, CameraOff, Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function ScannerModal({ onClose, onDetected }: { onClose: () => void; onDetected: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [isStarting, setIsStarting] = useState(true);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let active = true;
    let controls: { stop: () => void } | undefined;
    async function startCamera() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const video = videoRef.current;
        if (!video) throw new Error("Camera preview is unavailable.");
        const reader = new BrowserMultiFormatReader();
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const rearCamera = devices.find((device) => /back|rear|environment/i.test(device.label));
        if (!devices.length) throw new Error("No camera was found on this device.");
        const scanControls = await reader.decodeFromVideoDevice(rearCamera?.deviceId, video, (result) => {
          if (!active || !result) return;
          const value = result.getText().replace(/\D/g, "");
          if (value) {
            active = false;
            scanControls.stop();
            onDetectedRef.current(value);
          }
        });
        controls = scanControls;
        if (active) setCameraReady(true);
        else scanControls.stop();
      } catch (error) {
        if (active) setCameraError(error instanceof Error ? error.message : "Unable to start the camera. Enter the barcode manually.");
      } finally {
        if (active) setIsStarting(false);
      }
    }
    void startCamera();
    return () => {
      active = false;
      controls?.stop();
    };
  }, []);

  return <motion.div className="scanner-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.section className="scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-title" initial={{ opacity: 0, y: 16, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}>
      <header className="scanner-header"><div><span className="eyebrow">CAMERA SCAN</span><h2 id="scanner-title">Find the casting</h2></div><button className="icon-button" onClick={onClose} aria-label="Close scanner"><X size={19} /></button></header>
      <div className="scanner-view"><video ref={videoRef} autoPlay muted playsInline aria-label="Barcode scanner camera preview" /><div className="scanner-vignette" /><div className="scanner-target"><span /><span /><span /><span /><i /></div><div className="scanner-status">{cameraReady ? <><span className="status-dot" /> CAMERA LIVE</> : isStarting ? <><Camera size={14} /> STARTING CAMERA</> : <><CameraOff size={14} /> CAMERA UNAVAILABLE</>}</div>{cameraError && <p className="scanner-error">{cameraError}</p>}<span className="scanner-hint">Position the barcode inside the frame</span></div>
      <div className="scanner-form"><span>OR ENTER IT MANUALLY</span><form onSubmit={(event) => { event.preventDefault(); const normalized = manualCode.replace(/\D/g, ""); if (normalized) onDetected(normalized); }}><label><Barcode size={17} /><input inputMode="numeric" autoComplete="off" value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="UPC or EAN number" aria-label="Enter barcode manually" /><button type="submit" disabled={!manualCode.trim()} aria-label="Use barcode"><Check size={17} /></button></label></form><small>Barcodes can be shared across castings. Add the model details to confirm a match.</small></div>
    </motion.section>
  </motion.div>;
}