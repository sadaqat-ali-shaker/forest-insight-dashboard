import { useEffect, useRef } from "react";
import * as Potree from "potree";

const LidarViewer = () => {
  const viewerContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewerContainer.current) return;

    const viewer = new Potree.Viewer(viewerContainer.current);

    viewer.setEDLEnabled(true);
    viewer.setFOV(60);
    viewer.setPointBudget(1_000_000);
    viewer.loadSettingsFromURL();

    viewer.setBackground("gradient");

    Potree.loadPointCloud(
      "/potree_output/metadata.json",
      "forest",
      (e: any) => {
        const pointcloud = e.pointcloud;

        viewer.scene.addPointCloud(pointcloud);
        viewer.fitToScreen();
      }
    );
  }, []);

  return (
    <div
      ref={viewerContainer}
      style={{
        width: "100%",
        height: "500px",
        borderRadius: "10px",
        overflow: "hidden"
      }}
    />
  );
};

export default LidarViewer;