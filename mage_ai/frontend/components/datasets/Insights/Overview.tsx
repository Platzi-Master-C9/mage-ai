import React from 'react';
import styled from 'styled-components';

import BarGraphHorizontal from '@components/charts/BarGraphHorizontal';
import FeatureType from '@interfaces/FeatureType';
import FlexContainer from '@oracle/components/FlexContainer';
import Histogram from '@components/charts/Histogram';
import SimpleDataTable from '@oracle/components/Table/SimpleDataTable';
import Spacing from '@oracle/elements/Spacing';
import Text from '@oracle/elements/Text';
import light from '@oracle/styles/themes/light';
import { BORDER_RADIUS_LARGE } from '@oracle/styles/units/borders';
import { GRAY_LINES, SILVER } from '@oracle/styles/colors/main';
import {
  NULL_VALUE_HIGH_THRESHOLD,
  NULL_VALUE_LOW_THRESHOLD,
  UNIQUE_VALUE_HIGH_THRESHOLD,
  UNIQUE_VALUE_LOW_THRESHOLD,
  UNUSUAL_ROW_VOLUME_FACTOR,
} from './constants';
import { PADDING, UNIT } from '@oracle/styles/units/spacing';
import {
  buildDistributionData,
  hasHighDistribution,
} from '@components/datasets/Insights/utils/data';
import { formatPercent, numberWithCommas } from '@utils/string';
import { indexBy, maxInArray, sortByKey } from '@utils/array';

export const ChartStyle = styled.div`
  border: 1px solid ${GRAY_LINES};
  border-radius: ${BORDER_RADIUS_LARGE}px;
`;

export const ChartHeaderStyle = styled.div`
  background: 
`;

export const HeaderStyle = styled.div`
  background: ${SILVER};
  padding: ${PADDING}px;
  border-bottom: 1px solid ${GRAY_LINES};
  border-top-left-radius: ${BORDER_RADIUS_LARGE}px;
  border-top-right-radius: ${BORDER_RADIUS_LARGE}px;
`;

export const BodyStyle = styled.div<any>`
  ${props => !props.noPadding && `
    padding: ${PADDING}px;
  `}
  border-bottom-left-radius: ${BORDER_RADIUS_LARGE}px;
  border-bottom-right-radius: ${BORDER_RADIUS_LARGE}px;
`;

type ChartContainerProps = {
  children: any;
  noPadding?: boolean;
  title: string;
};

type OverviewProps = {
  features: FeatureType[];
  insightsOverview: any;
  statistics: any;
};

export function ChartContainer({
  children,
  noPadding = false,
  title,
}: ChartContainerProps) {
  return (
    <ChartStyle>
      <FlexContainer flexDirection="column">
        <HeaderStyle>
          <Text bold>
            {title}
          </Text>
        </HeaderStyle>
        <BodyStyle noPadding={noPadding}>
          {children}
        </BodyStyle>
      </FlexContainer>
    </ChartStyle>
  );
}

export function ChartRow({
  left,
  right
}: {
  left: any,
  right?: any,
}) {
  return (
    <Spacing mb={4}>
      <FlexContainer>
        <FlexContainer flex={1}>
          <div style={{ width: '100%', height: '100%' }}>
            {left}
          </div>
        </FlexContainer>
        {right && (
          <>
            <Spacing mr={4} />
            <FlexContainer flex={1}>
              <div style={{ width: '100%', height: '100%' }}>
                {right}
              </div>
            </FlexContainer>
          </>
        )}
      </FlexContainer>
    </Spacing>
  );
}

function Overview({
  features,
  insightsOverview,
  statistics,
}: OverviewProps) {
  const {
    time_series: timeSeries,
  } = insightsOverview;

  const featuresByUUID = indexBy(features, ({ uuid }) => uuid);
  const timeSeriesData = [];
  const datesWithUnusualNumberOfRows = [];

  timeSeries?.forEach((chart) => {
    const {
      distribution,
      rangedWithUnusualDistribution,
    } = buildDistributionData(
      chart,
      featuresByUUID,
      {
        calculateAnomaly: ({
          y: yCurrent,
          yPrevious,
        }) => yPrevious
          && (yPrevious.count * UNUSUAL_ROW_VOLUME_FACTOR) <= yCurrent.count,
        getYValue: ({ count }) => count,
      },
    );

    timeSeriesData.push(distribution);
    datesWithUnusualNumberOfRows.push(rangedWithUnusualDistribution);
  });

  const allColumnsWithNullValues = [];
  const columnsWithLowNullValues = [];
  const columnsWithHighNullValues = [];
  features.forEach((feature: FeatureType) => {
    const { uuid } = feature;
    const value = statistics[`${uuid}/null_value_rate`];

    if (typeof value !== 'undefined') {
      const data = { feature, value: 1 - value };

      if (!value || value <= NULL_VALUE_LOW_THRESHOLD) {
        columnsWithLowNullValues.push(data);
      } else if (value >= NULL_VALUE_HIGH_THRESHOLD) {
        columnsWithHighNullValues.push(data);
      }

      allColumnsWithNullValues.push(data);
    }
  });

  const timeSeriesHistograms = timeSeriesData.map(({
    data,
    featureUUID,
  }) => (
    <Histogram
      data={data.map(({
        isUnusual,
        x,
        xLabel,
        xLabelMax,
        xLabelMin,
        y,
      }) => [
        xLabel,
        y.count,
        xLabelMin,
        xLabelMax,
        x.min,
        x.max,
        isUnusual,
      ])}
      getBarColor={([,,,,,, isUnusual]) => isUnusual ? light.brand.wind400 : light.brand.wind300}
      height={UNIT * 50}
      key={featureUUID}
      large
      renderTooltipContent={([, count, xLabelMin, xLabelMax]) => (
        <Text small>
          Rows: {count}
          <br />
          Dates: {xLabelMin} - {xLabelMax}
        </Text>
      )}
      showYAxisLabels
      showZeroes
      sortData={d => sortByKey(d, '[4]')}
    />
  ));

  const allColumns = [];
  const columnsWithHighUniqueValues = [];
  const columnsWithLowUniqueValues = [];

  const columnsWithHighDistribution = [];

  features.forEach((feature: FeatureType) => {
    const { uuid } = feature;
    const count = statistics?.[`${uuid}/count`];
    if (count) {
      const uniqueValues = statistics[`${uuid}/count_distinct`];
      const uniquePercentage = uniqueValues / count;

      const valueCounts = statistics?.[uuid];
      const data: {
        count: number;
        distributionFeatureUUID?: string;
        distributionPercentage?: number;
        distributionValue?: number;
        feature: FeatureType;
        uniquePercentage: number;
        uniqueValues: number;
      } = {
        count,
        feature,
        uniquePercentage,
        uniqueValues,
      };

      if (uniquePercentage >= UNIQUE_VALUE_HIGH_THRESHOLD) {
        columnsWithHighUniqueValues.push(data);
      } else if (uniquePercentage <= UNIQUE_VALUE_LOW_THRESHOLD) {
        columnsWithLowUniqueValues.push(data);
      }

      if (valueCounts) {
        const [distributionFeatureUUID, distributionValueMax] = maxInArray(
          Object.entries(valueCounts).filter(([k, _]) => k !== null && String(k).trim().length >= 1),
          ([, v]) => v,
        );
        const distributionPercentage = distributionValueMax / count;

        data.distributionFeatureUUID = distributionFeatureUUID;
        data.distributionPercentage = distributionPercentage;
        data.distributionValue = distributionValueMax;

        if (hasHighDistribution(distributionValueMax, count, uniqueValues)) {
          columnsWithHighDistribution.push(data);
        }
      }

      allColumns.push(data);
    }
  });

  const columnsWithDistribution = allColumns.filter(({ distributionPercentage }) => distributionPercentage);

  return (
    <FlexContainer
      flexDirection="column"
      fullWidth
      justifyContent="center"
    >
      <ChartRow
        left={
          <ChartContainer
            title="Data completion"
          >
            <BarGraphHorizontal
              data={sortByKey(allColumnsWithNullValues, 'value').map(({ feature, value }) => ({
                x: value,
                y: feature.uuid,
              }))}
              height={Math.max(3 * allColumnsWithNullValues.length * UNIT, UNIT * 50)}
              renderTooltipContent={({ x, y }) => `${formatPercent(x)} of rows have a value`}
              xNumTicks={2}
              ySerialize={({ y }) => y}
            />
          </ChartContainer>
        }
        right={
          <ChartContainer
            noPadding={columnsWithHighNullValues.length >= 1}
            title="Columns with a lot of missing values"
          >
            {columnsWithHighNullValues.length === 0 && (
              <Text>
                All columns have a healthy amount of values.
              </Text>
            )}

            {columnsWithHighNullValues.length >= 1 && (
              <SimpleDataTable
                columnFlexNumbers={[1, 1]}
                columnHeaders={[
                  {
                    label: 'Column',
                  },
                  {
                    label: '% missing values',
                  },
                ]}
                rowGroupData={[
                  {
                    rowData: sortByKey(columnsWithHighNullValues.slice(0, 12), 'value').map(({ feature, value }) => ({
                      columnValues: [feature.uuid, formatPercent(1 - value)],
                      uuid: feature.uuid,
                    })),
                  },
                ]}
                small
              />
            )}
          </ChartContainer>
        }
      />
      {timeSeriesHistograms.length >= 1 &&
        timeSeriesHistograms.map((chart, idx) => {
          const uuid = timeSeries[idx]?.x_metadata?.label;
          const unusualDates = datesWithUnusualNumberOfRows[idx];

          return (
            <ChartRow
              key={uuid}
              left={
                <ChartContainer
                  title={`Number of rows by date, column: ${uuid}`}
                >
                  {chart}
                </ChartContainer>
              }
              right={
                <ChartContainer
                  noPadding={unusualDates.length >= 1}
                  title="Dates with unusual number of rows"
                >
                  {unusualDates.length === 0 && (
                    <Text>
                      There are no unusual dates.
                    </Text>
                  )}
                  {unusualDates.length >= 1 && (
                    <SimpleDataTable
                      columnFlexNumbers={[1, 1, 1]}
                      columnHeaders={[
                        {
                          label: 'Start date',
                        },
                        {
                          label: 'End date',
                        },
                        {
                          label: 'Rows',
                        },
                      ]}
                      rowGroupData={[
                        {
                          rowData: unusualDates.slice(0, 12).map(({ xLabelMax, xLabelMin, y }) => ({
                            columnValues: [
                              xLabelMin,
                              xLabelMax,
                              numberWithCommas(y.count),
                            ],
                            uuid: '',
                          })),
                        },
                      ]}
                      small
                    />
                  )}
                </ChartContainer>
              }
            />
          );
        })
      }
      <ChartRow
        left={
          <ChartContainer
            title="Number of unique values"
          >
            <BarGraphHorizontal
              data={sortByKey(allColumns, 'uniqueValues').map(({ feature, uniqueValues }) => ({
                x: uniqueValues,
                y: feature.uuid,
              }))}
              height={Math.max(3 * allColumns.length * UNIT, UNIT * 50)}
              renderTooltipContent={({ x }) => `${numberWithCommas(x)} unique values`}
              xNumTicks={2}
              ySerialize={({ y }) => y}
            />
          </ChartContainer>
        }
        right={
          <ChartContainer
            noPadding={columnsWithHighUniqueValues.length >= 1}
            title="Columns with a lot of unique values"
          >
            {columnsWithHighUniqueValues.length === 0 && (
              <Text>
                All columns have a good amount of variation in the data.
              </Text>
            )}

            {columnsWithHighUniqueValues.length >= 1 && (
              <SimpleDataTable
                columnFlexNumbers={[1, 1]}
                columnHeaders={[
                  {
                    label: 'Column',
                  },
                  {
                    label: '% unique values',
                  },
                ]}
                rowGroupData={[
                  {
                    rowData: sortByKey(
                      columnsWithHighUniqueValues.slice(0, 12),
                      'uniquePercentage',
                      { ascending: false },
                    ).map(({ feature, uniquePercentage }) => ({
                      columnValues: [feature.uuid, formatPercent(uniquePercentage)],
                      uuid: feature.uuid,
                    })),
                  },
                ]}
                small
              />
            )}
          </ChartContainer>
        }
      />
      {columnsWithDistribution.length >= 1 && (
        <ChartRow
          left={
            <ChartContainer
              title="Distribution of values"
            >
              <BarGraphHorizontal
                data={sortByKey(
                  columnsWithDistribution,
                  'distributionPercentage',
                ).map(({
                  feature,
                  distributionFeatureUUID,
                  distributionPercentage,
                }) => ({
                  distributionFeatureUUID,
                  x: distributionPercentage,
                  y: feature.uuid,
                }))}
                height={Math.max(3 * columnsWithDistribution.length * UNIT, UNIT * 50)}
                renderTooltipContent={({
                  distributionFeatureUUID,
                  x,
                }) =>
                  `${distributionFeatureUUID} is ${formatPercent(x)} of all rows`
                }
                xNumTicks={2}
                ySerialize={({ y }) => y}
              />
            </ChartContainer>
          }
          right={
            <ChartContainer
              noPadding={columnsWithHighDistribution.length >= 1}
              title="Columns with imbalanced distribution"
            >
              {columnsWithHighDistribution.length === 0 && (
                <Text>
                  All columns have an even distribution of its values.
                </Text>
              )}

              {columnsWithHighDistribution.length >= 1 && (
                <SimpleDataTable
                  columnFlexNumbers={[2, 2, 1]}
                  columnHeaders={[
                    {
                      label: 'Column',
                    },
                    {
                      label: 'Most frequent value',
                    },
                    {
                      label: '% of rows',
                    },
                  ]}
                  rowGroupData={[
                    {
                      rowData: sortByKey(
                        columnsWithHighDistribution.slice(0, 12),
                        'distributionPercentage',
                        { ascending: false },
                      ).map(({
                        feature,
                        distributionFeatureUUID,
                        distributionPercentage,
                      }) => ({
                        columnValues: [
                          feature.uuid,
                          distributionFeatureUUID,
                          formatPercent(distributionPercentage),
                        ],
                        uuid: feature.uuid,
                      })),
                    },
                  ]}
                  small
                />
              )}
            </ChartContainer>
          }
        />
      )}
    </FlexContainer>
  );
}

export default Overview;
