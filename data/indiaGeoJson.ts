export interface IndiaStateFeature {
  type: 'Feature';
  id: string;
  properties: {
    stateCode: string;
    name: string;
    zone: string;
    capital: string;
    center: [number, number]; // [longitude, latitude]
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface IndiaGeoJson {
  type: 'FeatureCollection';
  features: IndiaStateFeature[];
}

export const INDIA_STATES_GEOJSON: IndiaGeoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: '27',
      properties: { stateCode: '27', name: 'Maharashtra', zone: 'WEST', capital: 'Mumbai', center: [75.7139, 19.7515] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [72.8, 20.2], [74.2, 21.9], [76.5, 21.4], [78.2, 21.6], [80.1, 20.8],
          [80.5, 18.9], [78.8, 19.8], [77.5, 18.1], [75.9, 17.7], [73.5, 15.8],
          [72.7, 18.9], [72.8, 20.2]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '29',
      properties: { stateCode: '29', name: 'Karnataka', zone: 'SOUTH', capital: 'Bengaluru', center: [75.7139, 15.3173] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [74.1, 18.5], [76.8, 17.5], [77.6, 15.9], [78.3, 13.8], [77.8, 12.0],
          [76.2, 11.8], [74.8, 14.1], [74.1, 15.8], [74.1, 18.5]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '07',
      properties: { stateCode: '07', name: 'Delhi', zone: 'NORTH', capital: 'New Delhi', center: [77.1025, 28.7041] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [76.8, 28.9], [77.3, 28.8], [77.3, 28.4], [76.9, 28.4], [76.8, 28.9]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '24',
      properties: { stateCode: '24', name: 'Gujarat', zone: 'WEST', capital: 'Gandhinagar', center: [71.1924, 22.2587] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [68.2, 23.8], [71.0, 24.7], [73.5, 24.3], [74.2, 22.3], [72.9, 20.3],
          [71.8, 20.8], [69.1, 22.4], [68.2, 23.8]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '33',
      properties: { stateCode: '33', name: 'Tamil Nadu', zone: 'SOUTH', capital: 'Chennai', center: [78.6569, 11.1271] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.8, 13.5], [80.3, 13.3], [79.8, 10.8], [78.2, 8.1], [77.2, 8.2],
          [76.3, 10.2], [76.9, 11.8], [77.8, 13.5]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '09',
      properties: { stateCode: '09', name: 'Uttar Pradesh', zone: 'NORTH', capital: 'Lucknow', center: [80.9462, 26.8467] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.1, 29.8], [78.8, 29.5], [80.9, 28.7], [83.3, 27.2], [84.3, 25.8],
          [82.9, 24.1], [79.8, 24.2], [78.1, 27.2], [77.1, 29.8]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '36',
      properties: { stateCode: '36', name: 'Telangana', zone: 'SOUTH', capital: 'Hyderabad', center: [79.0193, 18.1124] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.2, 19.9], [79.8, 19.5], [80.9, 17.8], [79.8, 16.0], [77.8, 15.8],
          [77.4, 17.7], [77.2, 19.9]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '19',
      properties: { stateCode: '19', name: 'West Bengal', zone: 'EAST', capital: 'Kolkata', center: [87.8550, 22.9868] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [88.0, 27.2], [88.9, 26.5], [88.2, 24.8], [88.9, 22.8], [87.5, 21.6],
          [86.7, 22.8], [87.2, 24.2], [88.0, 27.2]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '06',
      properties: { stateCode: '06', name: 'Haryana', zone: 'NORTH', capital: 'Chandigarh', center: [76.0856, 29.0588] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [74.5, 29.8], [76.9, 30.5], [77.5, 29.2], [77.2, 27.8], [75.5, 28.2], [74.5, 29.8]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '08',
      properties: { stateCode: '08', name: 'Rajasthan', zone: 'NORTH', capital: 'Jaipur', center: [74.2179, 27.0238] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [69.5, 26.8], [73.2, 29.9], [76.8, 28.5], [77.8, 26.8], [74.8, 23.5],
          [71.0, 24.5], [69.5, 26.8]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '23',
      properties: { stateCode: '23', name: 'Madhya Pradesh', zone: 'CENTRAL', capital: 'Bhopal', center: [78.6569, 22.9734] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [74.1, 22.0], [76.5, 26.1], [80.2, 25.0], [82.8, 24.0], [81.5, 21.8],
          [78.5, 21.5], [74.1, 22.0]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '32',
      properties: { stateCode: '32', name: 'Kerala', zone: 'SOUTH', capital: 'Thiruvananthapuram', center: [76.2711, 10.8505] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [74.9, 12.8], [76.2, 11.9], [77.2, 10.2], [77.5, 8.3], [76.9, 8.4],
          [76.0, 10.5], [74.9, 12.8]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '37',
      properties: { stateCode: '37', name: 'Andhra Pradesh', zone: 'SOUTH', capital: 'Amaravati', center: [79.7400, 15.9129] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.0, 15.5], [79.5, 16.5], [81.2, 17.8], [84.7, 19.1], [83.2, 17.5],
          [80.1, 13.5], [78.2, 13.8], [77.0, 15.5]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '03',
      properties: { stateCode: '03', name: 'Punjab', zone: 'NORTH', capital: 'Chandigarh', center: [75.3412, 31.1471] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [74.0, 31.0], [75.8, 32.5], [76.9, 31.2], [75.8, 29.8], [74.0, 31.0]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '21',
      properties: { stateCode: '21', name: 'Odisha', zone: 'EAST', capital: 'Bhubaneswar', center: [84.8035, 20.9517] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [81.4, 18.2], [83.8, 22.5], [86.9, 22.2], [87.5, 21.5], [85.2, 19.5],
          [81.4, 18.2]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '10',
      properties: { stateCode: '10', name: 'Bihar', zone: 'EAST', capital: 'Patna', center: [85.3131, 25.0961] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [83.3, 27.3], [88.1, 26.5], [87.8, 24.8], [83.9, 24.5], [83.3, 27.3]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '20',
      properties: { stateCode: '20', name: 'Jharkhand', zone: 'EAST', capital: 'Ranchi', center: [85.2799, 23.6102] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [83.3, 24.2], [87.8, 25.2], [87.5, 22.5], [84.2, 22.0], [83.3, 24.2]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '22',
      properties: { stateCode: '22', name: 'Chhattisgarh', zone: 'CENTRAL', capital: 'Raipur', center: [81.8661, 21.2787] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [80.2, 23.8], [83.5, 23.8], [84.4, 21.2], [81.5, 17.8], [80.2, 21.0], [80.2, 23.8]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '05',
      properties: { stateCode: '05', name: 'Uttarakhand', zone: 'NORTH', capital: 'Dehradun', center: [79.0193, 30.0668] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.6, 30.5], [80.9, 31.3], [81.0, 29.8], [78.8, 29.0], [77.6, 30.5]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '02',
      properties: { stateCode: '02', name: 'Himachal Pradesh', zone: 'NORTH', capital: 'Shimla', center: [77.1734, 31.1048] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [75.6, 32.2], [78.8, 33.2], [78.7, 31.2], [76.8, 30.5], [75.6, 32.2]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '18',
      properties: { stateCode: '18', name: 'Assam', zone: 'NORTHEAST', capital: 'Dispur', center: [92.9376, 26.2006] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [89.7, 26.2], [93.2, 27.8], [95.8, 27.5], [92.5, 24.8], [89.7, 26.2]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '30',
      properties: { stateCode: '30', name: 'Goa', zone: 'WEST', capital: 'Panaji', center: [74.1240, 15.2993] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [73.7, 15.8], [74.3, 15.7], [74.2, 14.9], [73.7, 15.0], [73.7, 15.8]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '01',
      properties: { stateCode: '01', name: 'Jammu & Kashmir', zone: 'NORTH', capital: 'Srinagar', center: [74.7973, 34.0837] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [73.5, 34.8], [76.8, 35.5], [76.5, 32.5], [74.0, 32.5], [73.5, 34.8]
        ]]
      }
    },
    {
      type: 'Feature',
      id: '38',
      properties: { stateCode: '38', name: 'Ladakh', zone: 'NORTH', capital: 'Leh', center: [77.5771, 34.1526] },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [76.0, 36.5], [80.3, 35.5], [79.2, 32.5], [76.5, 33.0], [76.0, 36.5]
        ]]
      }
    }
  ]
};
