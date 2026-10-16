import type { Incident, Position } from "../domain/types";
export interface MapProps {
  alerts: Incident[];
  position: Position | null;
  height?: number;
  title?: string;
  positionTitle?: string;
  editable?: boolean;
  focusAlertId?: string;
  onPositionChange?: (position: Position) => void;
}
