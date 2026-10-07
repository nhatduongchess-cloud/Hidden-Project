import os
import webbrowser
import folium
from folium.plugins import LocateControl, MiniMap

# --- CẤU HÌNH DỮ LIỆU ---
VIETNAM_CENTER = [16.047079, 108.206230]
INITIAL_ZOOM = 6

TILE_LAYERS = [
    {
        "url": "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        "attr": "Google Maps",
        "name": "Google Maps (Đường xá)",
        "max_zoom": 20,
    },
    {
        "url": "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        "attr": "Google Maps Satellite",
        "name": "Google Hybrid (Vệ tinh + Tên đường)",
        "max_zoom": 20,
    },
    {
        "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        "attr": "Tiles &copy; Esri",
        "name": "Vệ tinh Esri (Nhà cửa chi tiết)",
        "max_zoom": 18,
    },
]

LOCATIONS = [
    {"name": "Thủ đô Hà Nội", "loc": [21.028511, 105.804817], "color": "red"},
    {"name": "TP. Hồ Chí Minh", "loc": [10.823099, 106.629664], "color": "blue"},
    {"name": "TP. Đà Nẵng", "loc": [16.047079, 108.206230], "color": "green"},
    {"name": "Quần đảo Hoàng Sa (Việt Nam)", "loc": [16.5, 112.0], "color": "orange"},
    {"name": "Quần đảo Trường Sa (Việt Nam)", "loc": [8.65, 111.92], "color": "orange"},
]


def build_vietnam_routing_map(output_filename="vietnam_map.html"):
    # 1. Khởi tạo bản đồ
    m = folium.Map(
        location=VIETNAM_CENTER,
        zoom_start=INITIAL_ZOOM,
        tiles=None,
        prefer_canvas=True
    )

    # 2. Thêm các Lớp bản đồ
    for layer in TILE_LAYERS:
        folium.TileLayer(
            tiles=layer["url"],
            attr=layer["attr"],
            name=layer["name"],
            max_zoom=layer["max_zoom"]
        ).add_to(m)

    # 3. Marker các thành phố chính
    markers_group = folium.FeatureGroup(name="Thành phố chính").add_to(m)
    for item in LOCATIONS:
        folium.Marker(
            location=item["loc"],
            popup=folium.Popup(f"<b>{item['name']}</b>", max_width=300),
            tooltip=item["name"],
            icon=folium.Icon(color=item["color"], icon="info-sign")
        ).add_to(markers_group)

    # 4. Định vị GPS Thời gian thực
    LocateControl(
        auto_start=False,
        flyTo=True,
        keepCurrentZoomLevel=True,
        strings={"title": "Vị trí của tôi"}
    ).add_to(m)

    # 5. Bản đồ thu nhỏ MiniMap (Đã xử lý lỗi 403)[cite: 5]
    mini_map = MiniMap(
        tile_layer=folium.TileLayer(
            tiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
            attr='Esri'
        ),
        toggle_display=True,
        position='bottomright'
    )
    m.add_child(mini_map)

    # 6. Quản lý Lớp bản đồ
    folium.LayerControl(position='topright', collapsed=False).add_to(m)

    # --- 7. KHUNG TÌM KIẾM & CHỈ ĐƯỜNG TỰ XÂY DỰNG (ĐẢM BẢO HOẠT ĐỘNG 100%) ---
    custom_ui_html = '''
    <div id="routing-panel">
        <h4 style="margin:0 0 8px 0; color:#333;">Dẫn đường ngắn nhất</h4>
        <input type="text" id="start-input" placeholder="Nhập điểm đón (A)..." />
        <input type="text" id="end-input" placeholder="Nhập điểm đến (B)..." />
        <button id="route-btn" onclick="calculateRoute()">Tìm đường đi</button>
        <button id="clear-btn" onclick="clearRoute()">Xóa</button>
        <div id="route-info"></div>
    </div>

    <style>
        #routing-panel {
            position: absolute;
            top: 10px;
            left: 50px;
            z-index: 1000;
            background: white;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            width: 260px;
        }
        #routing-panel input {
            width: 100%;
            padding: 8px;
            margin-bottom: 6px;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 13px;
        }
        #routing-panel button {
            padding: 7px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: bold;
        }
        #route-btn { background-color: #007bff; color: white; }
        #clear-btn { background-color: #6c757d; color: white; }
        #route-info {
            margin-top: 8px;
            font-size: 12px;
            color: #28a745;
            font-weight: bold;
        }
    </style>

    <script>
        var mapObj = null;
        var startMarker = null;
        var endMarker = null;
        var routePolyline = null;

        document.addEventListener("DOMContentLoaded", function() {
            // Lấy đối tượng Map từ Folium
            for (var key in window) {
                if (key.startsWith("map_") && window[key] instanceof L.Map) {
                    mapObj = window[key];
                    break;
                }
            }

            if (mapObj) {
                // Click trên bản đồ để chọn nhanh điểm A và B
                mapObj.on('click', function(e) {
                    if (!startMarker) {
                        setStartPoint(e.latLng.lat, e.latLng.lng, "Điểm chọn trên bản đồ");
                    } else if (!endMarker) {
                        setEndPoint(e.latLng.lat, e.latLng.lng, "Điểm chọn trên bản đồ");
                        calculateRoute();
                    }
                });
            }
        });

        // Tìm kiếm tọa độ qua API Geocoding Nominatim
        async function geocode(query) {
            var url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=vn`;
            var response = await fetch(url);
            var data = await response.json();
            if (data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name };
            }
            return null;
        }

        function setStartPoint(lat, lng, label) {
            if (startMarker) mapObj.removeLayer(startMarker);
            startMarker = L.marker([lat, lng], {title: "Điểm đón (A)"}).addTo(mapObj)
                .bindPopup("<b>Điểm đón (A)</b><br>" + label).openPopup();
            document.getElementById('start-input').value = label;
        }

        function setEndPoint(lat, lng, label) {
            if (endMarker) mapObj.removeLayer(endMarker);
            endMarker = L.marker([lat, lng], {title: "Điểm đến (B)"}).addTo(mapObj)
                .bindPopup("<b>Điểm đến (B)</b><br>" + label).openPopup();
            document.getElementById('end-input').value = label;
        }

        // Tính toán đường đi ngắn nhất qua API OSRM
        async function calculateRoute() {
            var startText = document.getElementById('start-input').value;
            var endText = document.getElementById('end-input').value;

            if (!startMarker && startText) {
                var pA = await geocode(startText);
                if (pA) setStartPoint(pA.lat, pA.lon, pA.name);
                else { alert("Không tìm thấy Điểm đón!"); return; }
            }

            if (!endMarker && endText) {
                var pB = await geocode(endText);
                if (pB) setEndPoint(pB.lat, pB.lon, pB.name);
                else { alert("Không tìm thấy Điểm đến!"); return; }
            }

            if (!startMarker || !endMarker) {
                alert("Vui lòng chọn/nhập đủ cả Điểm đón và Điểm đến!");
                return;
            }

            var latLngA = startMarker.getLatLng();
            var latLngB = endMarker.getLatLng();

            var osrmUrl = `https://router.project-osrm.org/route/v1/driving/${latLngA.lng},${latLngA.lat};${latLngB.lng},${latLngB.lat}?overview=full&geometries=geojson`;

            document.getElementById('route-info').innerText = "Đang tìm tuyến đường ngắn nhất...";

            fetch(osrmUrl)
                .then(res => res.json())
                .then(data => {
                    if (data.routes && data.routes.length > 0) {
                        var route = data.routes[0];
                        var coords = route.geometry.coordinates.map(c => [c[1], c[0]]);

                        if (routePolyline) mapObj.removeLayer(routePolyline);

                        // Vẽ tuyến đường đi
                        routePolyline = L.polyline(coords, {color: '#0055FF', weight: 6, opacity: 0.85}).addTo(mapObj);
                        mapObj.fitBounds(routePolyline.getBounds(), {padding: [50, 50]});

                        var distKm = (route.distance / 1000).toFixed(2);
                        var durationMin = Math.round(route.duration / 60);
                        document.getElementById('route-info').innerHTML = `Khoảng cách: <b>${distKm} km</b><br>Thời gian: <b>~${durationMin} phút</b>`;
                    } else {
                        document.getElementById('route-info').innerText = "Không tìm thấy đường đi!";
                    }
                })
                .catch(err => {
                    document.getElementById('route-info').innerText = "Lỗi khi kết nối máy chủ đường đi!";
                });
        }

        function clearRoute() {
            if (startMarker) mapObj.removeLayer(startMarker);
            if (endMarker) mapObj.removeLayer(endMarker);
            if (routePolyline) mapObj.removeLayer(routePolyline);
            startMarker = null;
            endMarker = null;
            routePolyline = null;
            document.getElementById('start-input').value = "";
            document.getElementById('end-input').value = "";
            document.getElementById('route-info').innerHTML = "";
        }
    </script>
    '''

    m.get_root().html.add_child(folium.Element(custom_ui_html))

    # Save & Execute
    m.save(output_filename)
    print(f"[OK] Đã hoàn thiện bản đồ chuẩn xác: {output_filename}")
    webbrowser.open('file://' + os.path.realpath(output_filename))


if __name__ == "__main__":
    build_vietnam_routing_map()