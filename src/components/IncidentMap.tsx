import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { router } from "expo-router";
import type { MapProps } from "./map-types";
import { RISK, STATUS } from "../domain/rules";
export type { MapProps } from "./map-types";
export default function IncidentMap({
  alerts,
  position,
  height = 400,
  title = "Mapa de ocorrências",
  positionTitle = "Sua localização",
  editable = false,
  onPositionChange,
  focusAlertId,
}: MapProps) {
  const map = useRef<MapView>(null);
  useEffect(() => {
    const focused = alerts.find((a) => a.id === focusAlertId);
    const center = focused ?? position ?? alerts[0];
    if (center)
      map.current?.animateToRegion(
        {
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: editable || focused ? 0.003 : 0.04,
          longitudeDelta: editable || focused ? 0.003 : 0.04,
        },
        400,
      );
  }, [position, alerts, focusAlertId, editable]);
  return (
    <View
      accessibilityLabel={title}
      style={{ height, borderRadius: 16, overflow: "hidden" }}
    >
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: position?.latitude ?? alerts[0]?.latitude ?? -23.5505,
          longitude: position?.longitude ?? alerts[0]?.longitude ?? -46.6333,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        showsUserLocation={false}
        zoomEnabled
        scrollEnabled
        onPress={(event) => {
          if (editable)
            onPositionChange?.({
              ...event.nativeEvent.coordinate,
              accuracy: null,
              captured_at: new Date().toISOString(),
            });
        }}
      >
        {position && (
          <Marker
            coordinate={position}
            title={positionTitle}
            pinColor={editable ? "#176748" : "#2563a6"}
            draggable={editable}
            onDragEnd={(event) =>
              onPositionChange?.({
                ...event.nativeEvent.coordinate,
                accuracy: null,
                captured_at: new Date().toISOString(),
              })
            }
          />
        )}
        {position && position.accuracy !== null && (
          <Circle
            center={position}
            radius={position.accuracy}
            fillColor="#2563a622"
            strokeColor="#2563a6"
          />
        )}
        {alerts
          .filter((a) => a.id === focusAlertId)
          .map((a) => (
            <Circle
              key={`area-${a.id}`}
              center={a}
              radius={100}
              fillColor={`${RISK[a.risk].color}16`}
              strokeColor={RISK[a.risk].color}
              strokeWidth={1}
            />
          ))}
        {alerts.map((a) => (
          <Marker
            key={a.id}
            accessibilityLabel={`Ocorrência: ${a.title}. Risco ${a.risk} de 4: ${RISK[a.risk].label}. ${STATUS[a.status]}`}
            coordinate={a}
            pinColor={a.status === "resolved" ? "#176748" : RISK[a.risk].color}
            title={`Risco ${a.risk}/4: ${RISK[a.risk].label} · ${STATUS[a.status]}`}
            description={a.title}
            onCalloutPress={() => router.push(`/alert/${a.id}`)}
          >
            <View
              style={{
                backgroundColor: "white",
                borderWidth: 2,
                borderColor: RISK[a.risk].color,
                borderRadius: 10,
                padding: 6,
                minHeight: 44,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: RISK[a.risk].color,
                  fontWeight: "800",
                  fontSize: 12,
                }}
              >
                {a.risk}/4 {RISK[a.risk].label}
              </Text>
              <Text style={{ color: "#102c43", fontSize: 10 }}>
                {STATUS[a.status]}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
