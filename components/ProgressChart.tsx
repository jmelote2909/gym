import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useSettings } from '@/src/context/SettingsContext';

interface DataPoint {
  date: string;
  value: number;
}

interface ProgressChartProps {
  data: DataPoint[];
  title: string;
  unit?: string;
  color?: string;
}

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 40;
const CHART_HEIGHT = 200;
const PADDING = 20;

export default function ProgressChart({ data, title, unit = 'kg', color = '#E8FB4B' }: ProgressChartProps) {
  const { colors } = useSettings();

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.secondary }]}>No hay datos disponibles</Text>
        </View>
      </View>
    );
  }

  const values = data.map(d => d.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;

  const chartWidth = CHART_WIDTH - (PADDING * 2);
  const chartHeight = CHART_HEIGHT - (PADDING * 2);
  const stepX = chartWidth / (data.length - 1 || 1);

  // Crear puntos para el gráfico
  const points = data.map((point, index) => {
    const x = PADDING + (index * stepX);
    const normalizedValue = (point.value - minValue) / range;
    const y = PADDING + chartHeight - (normalizedValue * chartHeight);
    return { x, y, value: point.value };
  });

  // Crear path para la línea
  const linePath = points.map((p, i) => 
    i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
  ).join(' ');

  // Crear path para el área bajo la línea
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PADDING + chartHeight} L ${PADDING} ${PADDING + chartHeight} Z`;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      
      <View style={styles.chartContainer}>
        {/* Líneas de referencia horizontales */}
        <View style={[styles.gridLine, { top: PADDING, borderColor: colors.border }]} />
        <View style={[styles.gridLine, { top: PADDING + chartHeight / 2, borderColor: colors.border }]} />
        <View style={[styles.gridLine, { top: PADDING + chartHeight, borderColor: colors.border }]} />

        {/* Valores de referencia */}
        <Text style={[styles.yAxisLabel, { top: PADDING - 10, color: colors.secondary }]}>
          {maxValue.toFixed(0)}{unit}
        </Text>
        <Text style={[styles.yAxisLabel, { top: PADDING + chartHeight / 2 - 10, color: colors.secondary }]}>
          {((maxValue + minValue) / 2).toFixed(0)}{unit}
        </Text>
        <Text style={[styles.yAxisLabel, { top: PADDING + chartHeight - 10, color: colors.secondary }]}>
          {minValue.toFixed(0)}{unit}
        </Text>

        {/* Área bajo la curva (gradiente simulado) */}
        <View style={styles.svgContainer}>
          {points.map((point, index) => {
            if (index === 0) return null;
            const prevPoint = points[index - 1];
            const barHeight = PADDING + chartHeight - point.y;
            
            return (
              <View
                key={index}
                style={[
                  styles.bar,
                  {
                    left: prevPoint.x,
                    bottom: 0,
                    width: stepX,
                    height: barHeight,
                    backgroundColor: color + '20',
                  }
                ]}
              />
            );
          })}
        </View>

        {/* Línea del gráfico */}
        {points.map((point, index) => {
          if (index === 0) return null;
          const prevPoint = points[index - 1];
          const lineLength = Math.sqrt(
            Math.pow(point.x - prevPoint.x, 2) + Math.pow(point.y - prevPoint.y, 2)
          );
          const angle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x) * (180 / Math.PI);

          return (
            <View
              key={`line-${index}`}
              style={[
                styles.line,
                {
                  left: prevPoint.x,
                  top: prevPoint.y,
                  width: lineLength,
                  backgroundColor: color,
                  transform: [{ rotate: `${angle}deg` }],
                }
              ]}
            />
          );
        })}

        {/* Puntos en el gráfico */}
        {points.map((point, index) => (
          <View
            key={`point-${index}`}
            style={[
              styles.point,
              {
                left: point.x - 4,
                top: point.y - 4,
                backgroundColor: color,
                borderColor: colors.card,
              }
            ]}
          />
        ))}
      </View>

      {/* Etiquetas del eje X (fechas) */}
      <View style={styles.xAxisContainer}>
        <Text style={[styles.xAxisLabel, { color: colors.secondary }]}>
          {data[0].date}
        </Text>
        {data.length > 2 && (
          <Text style={[styles.xAxisLabel, { color: colors.secondary }]}>
            {data[Math.floor(data.length / 2)].date}
          </Text>
        )}
        <Text style={[styles.xAxisLabel, { color: colors.secondary }]}>
          {data[data.length - 1].date}
        </Text>
      </View>

      {/* Estadísticas */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: color }]}>
            {values[values.length - 1].toFixed(1)}{unit}
          </Text>
          <Text style={[styles.statLabel, { color: colors.secondary }]}>Actual</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: color }]}>
            {maxValue.toFixed(1)}{unit}
          </Text>
          <Text style={[styles.statLabel, { color: colors.secondary }]}>Máximo</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: color }]}>
            {(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}{unit}
          </Text>
          <Text style={[styles.statLabel, { color: colors.secondary }]}>Promedio</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
  },
  chartContainer: {
    height: CHART_HEIGHT,
    width: CHART_WIDTH,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: PADDING,
    right: PADDING,
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  yAxisLabel: {
    position: 'absolute',
    left: 0,
    fontSize: 10,
    fontWeight: '600',
  },
  svgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    position: 'absolute',
  },
  line: {
    position: 'absolute',
    height: 3,
    transformOrigin: 'left center',
  },
  point: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  xAxisContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: PADDING,
  },
  xAxisLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
