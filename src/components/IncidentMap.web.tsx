import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import type * as Leaflet from "leaflet";
import "./map.css";
import type { MapProps } from "./map-types";
import { RISK, STATUS } from "../domain/rules";
import { Notice, Body } from "./ui";

export default function IncidentMap(props: MapProps) {
  const {
    alerts,
    position,
    height = 400,
    title = "Mapa de ocorrências",
    positionTitle = "Sua localização",
    editable = false,
    focusAlertId,
  } = props;
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<{
    L: typeof Leaflet;
    map: Leaflet.Map;
    layers: Leaflet.LayerGroup;
  } | null>(null);
  const latest = useRef(props),
    cameraKey = useRef("");
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    latest.current = props;
  }, [props]);
  useEffect(() => {
    let active = true,
      instance: Leaflet.Map | undefined,
      observer: ResizeObserver | undefined;
    void import("leaflet")
      .then((L) => {
        if (!active || !container.current) return;
        instance = L.map(container.current, {
          scrollWheelZoom: true,
          touchZoom: true,
          dragging: true,
          attributionControl: true,
          zoomAnimation: false,
          markerZoomAnimation: false,
          fadeAnimation: false,
        }).setView([-23.5505, -46.6333], 13);
        L.control.scale({ imperial: false, maxWidth: 100 }).addTo(instance);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        })
          .on("tileerror", () => {
            if (active)
              setError(
                "Não foi possível carregar algumas ruas do mapa. Verifique a conexão. Os pontos e a lista continuam disponíveis.",
              );
          })
          .on("tileload", () => {
            if (active) setError("");
          })
          .addTo(instance);
        engine.current = {
          L,
          map: instance,
          layers: L.layerGroup().addTo(instance),
        };
        instance.on("click", (event: Leaflet.LeafletMouseEvent) => {
          if (latest.current.editable)
            latest.current.onPositionChange?.({
              latitude: event.latlng.lat,
              longitude: event.latlng.lng,
              accuracy: null,
              captured_at: new Date().toISOString(),
            });
        });
        observer = new ResizeObserver(() =>
          instance?.invalidateSize({ pan: true, animate: false }),
        );
        observer.observe(container.current);
        setReady(true);
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível carregar o mapa. Você pode tentar novamente ou consultar a lista.",
          );
      });
    return () => {
      active = false;
      observer?.disconnect();
      instance?.stop();
      instance?.remove();
      instance = undefined;
      engine.current = null;
      cameraKey.current = "";
    };
  }, []);
  useEffect(() => {
    if (!ready || !engine.current) return;
    const { L, map, layers } = engine.current;
    layers.clearLayers();
    const points: Leaflet.LatLngTuple[] = [];
    for (const a of alerts) {
      const risk = RISK[a.risk],
        point: Leaflet.LatLngTuple = [a.latitude, a.longitude];
      points.push(point);
      const pin = document.createElement("div");
      pin.className = "safenow-map-pin";
      pin.style.background = a.status === "resolved" ? "#176748" : risk.color;
      const number = document.createElement("span");
      number.textContent = String(a.risk);
      pin.append(number);
      const label = `Ocorrência: ${a.title}. Risco ${a.risk} de 4: ${risk.label}. ${STATUS[a.status]}`;
      const marker = L.marker(point, {
        icon: L.divIcon({
          html: pin,
          className: "safenow-marker",
          iconSize: [36, 42],
          iconAnchor: [18, 42],
        }),
        title: label,
        keyboard: true,
      }).addTo(layers);
      marker.getElement()?.setAttribute("aria-label", label);
      marker.getElement()?.setAttribute("data-alert-id", a.id);
      const popup = document.createElement("div");
      popup.className = "safenow-map-popup";
      const heading = document.createElement("strong");
      heading.textContent = a.title;
      popup.append(heading);
      const status = document.createElement("p");
      status.textContent = `Risco ${a.risk}/4 · ${risk.label} · ${STATUS[a.status]}`;
      popup.append(status);
      const region = document.createElement("p");
      region.textContent = a.region || "Local aproximado da ocorrência";
      popup.append(region);
      if (focusAlertId !== a.id) {
        const button = document.createElement("button");
        button.textContent = "Abrir ocorrência";
        button.onclick = () => router.push(`/alert/${a.id}`);
        popup.append(button);
      }
      marker.bindPopup(popup, { autoPan: false });
      if (focusAlertId === a.id) {
        L.circle(point, {
          radius: 100,
          color: risk.color,
          weight: 1,
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(layers);
        marker.openPopup();
      }
    }
    if (position) {
      const point: Leaflet.LatLngTuple = [
        position.latitude,
        position.longitude,
      ];
      points.push(point);
      const pin = document.createElement("div");
      pin.className = editable ? "safenow-location-pin" : "safenow-user-dot";
      if (editable) pin.textContent = "●";
      const marker = L.marker(point, {
        icon: L.divIcon({
          html: pin,
          className: "safenow-marker",
          iconSize: [32, 36],
          iconAnchor: [16, editable ? 36 : 16],
        }),
        draggable: editable,
        title: positionTitle,
      }).addTo(layers);
      marker.getElement()?.setAttribute("aria-label", positionTitle);
      marker.bindTooltip(positionTitle, {
        permanent: true,
        direction: "top",
        offset: [0, editable ? -32 : -14],
      });
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        latest.current.onPositionChange?.({
          latitude: p.lat,
          longitude: p.lng,
          accuracy: null,
          captured_at: new Date().toISOString(),
        });
      });
      if (position.accuracy !== null)
        L.circle(point, {
          radius: position.accuracy,
          color: "#2563a6",
          fillOpacity: 0.1,
          weight: 1,
          interactive: false,
        }).addTo(layers);
    }
    const focused = alerts.find((a) => a.id === focusAlertId);
    const key = JSON.stringify([
      focusAlertId,
      position?.latitude,
      position?.longitude,
      editable,
      alerts.map((a) => [a.id, a.latitude, a.longitude]),
    ]);
    if (key !== cameraKey.current) {
      if (focused) map.setView([focused.latitude, focused.longitude], 16);
      else if (editable && position)
        map.setView([position.latitude, position.longitude], 17);
      else if (points.length === 1) map.setView(points[0]!, 16);
      else if (points.length > 1)
        map.fitBounds(L.latLngBounds(points), {
          padding: [45, 45],
          maxZoom: 16,
        });
      cameraKey.current = key;
    }
  }, [ready, alerts, position, editable, positionTitle, focusAlertId]);
  return (
    <View
      style={{
        height,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#d6e0e6",
        backgroundColor: "#e7eef1",
      }}
    >
      <div
        ref={container}
        role="region"
        aria-label={title}
        style={{ width: "100%", height: "100%", isolation: "isolate" }}
      />
      {!!error && (
        <View style={{ position: "absolute", top: 12, left: 12, right: 12 }}>
          <Notice error text={error} />
        </View>
      )}
      {!ready && !error && (
        <View
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            backgroundColor: "white",
            padding: 10,
            borderRadius: 10,
          }}
        >
          <Body>Carregando mapa…</Body>
        </View>
      )}
    </View>
  );
}
