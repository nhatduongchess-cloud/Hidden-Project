"""OR-Tools CVRPTW: multiple trucks, two capacities, windows and driving bans."""
import math
from ortools.constraint_solver import pywrapcp, routing_enums_pb2
from .models import OptimizeRequest


def optimize(req: OptimizeRequest, seconds: int = 3) -> dict:
    stations = req.stations
    n, count = len(stations) + 2, len(req.vehicles)
    manager = pywrapcp.RoutingIndexManager(n, count, [0] * count, [n - 1] * count)
    routing = pywrapcp.RoutingModel(manager)
    solver = routing.solver()
    classes = ['priority' if s.fillPct >= req.stopPct else
               'required' if max(s.fillPct, s.forecastPct) >= req.thresholdPct else
               'optional' if req.includeNearby and 50 <= s.fillPct <= 60 else
               'excluded' for s in stations]

    def meters(i, j):
        if routing.IsStart(i) and routing.IsEnd(j):
            return 0  # An unused truck stays parked rather than driving to the container.
        a, b = manager.IndexToNode(i), manager.IndexToNode(j)
        return math.ceil(req.distancesM[a][b] or 0)

    def travel(a, b):
        value = req.durationsS[a][b]
        return math.ceil(value / 60) if value is not None else 1441

    def transit(i, j):
        if routing.IsStart(i) and routing.IsEnd(j):
            return 0
        a, b = manager.IndexToNode(i), manager.IndexToNode(j)
        return travel(a, b) + (req.serviceMin if 1 <= a < n - 1 else 0)

    routing.SetArcCostEvaluatorOfAllVehicles(routing.RegisterTransitCallback(meters))
    time_index = routing.RegisterTransitCallback(transit)
    routing.AddDimension(time_index, 1440, 1440, False, 'Time')
    time = routing.GetDimensionOrDie('Time')
    for name, scale, demands, caps in (
        ('Mass', 1000, [s.massKg for s in stations], [v.payloadKg for v in req.vehicles]),
        ('Volume', 1000000, [s.volumeM3 for s in stations], [v.volumeM3 for v in req.vehicles]),
    ):
        values = [0] + [math.ceil(x * scale) for x in demands] + [0]
        idx = routing.RegisterUnaryTransitCallback(lambda i, vals=values: vals[manager.IndexToNode(i)])
        routing.AddDimensionWithVehicleCapacity(idx, 0, [math.floor(c * scale) for c in caps], True, name)

    for k, s in enumerate(stations):
        index = manager.NodeToIndex(k + 1)
        if s.close - req.serviceMin < s.open:
            if classes[k] in ('priority', 'required'):
                return {'feasible': False, 'message': f'{s.id}: thời gian phục vụ dài hơn khung mở cửa.', 'routes': []}
            classes[k] = 'excluded'
        else:
            time.CumulVar(index).SetRange(s.open, s.close - req.serviceMin)
        if classes[k] == 'excluded':
            routing.AddDisjunction([index], 0)
            solver.Add(routing.ActiveVar(index) == 0)
        elif classes[k] == 'optional':
            # Optional pickup must justify its extra distance (metres).
            routing.AddDisjunction([index], math.ceil(req.maxDetourKm * 1000))
        elif classes[k] == 'priority':
            # All priority stops are mandatory; penalize late service in the objective.
            time.SetCumulVarSoftUpperBound(index, min(v.start for v in req.vehicles), 100)
        routing.AddVariableMinimizedByFinalizer(time.CumulVar(index))

    for v, vehicle in enumerate(req.vehicles):
        time.CumulVar(routing.Start(v)).SetRange(vehicle.start, vehicle.start)
        time.CumulVar(routing.End(v)).SetRange(vehicle.start, vehicle.end)
        routing.AddVariableMinimizedByFinalizer(time.CumulVar(routing.End(v)))

    # Remove unreachable arcs, including all vehicle end indices. For a selected arc,
    # arrival <= ban.start OR arrival - travel >= ban.end, so driving never overlaps.
    # Waiting happens before departure and is already represented by the time slack.
    destinations = list(range(routing.Size())) + [routing.End(v) for v in range(count)]
    for i in range(routing.Size()):
        for j in destinations:
            if i == j or routing.IsStart(j) or (routing.IsStart(i) and routing.IsEnd(j)):
                continue
            a, b = manager.IndexToNode(i), manager.IndexToNode(j)
            if req.durationsS[a][b] is None or req.distancesM[a][b] is None:
                routing.NextVar(i).RemoveValue(j)
                continue
            duration = travel(a, b)
            if not duration:
                continue
            for ban in req.drivingBans:
                selected = solver.IsEqualCstVar(routing.NextVar(i), j)
                before = solver.IsLessOrEqualCstVar(time.CumulVar(j), ban.start)
                after = solver.IsGreaterOrEqualCstVar(time.CumulVar(j), ban.end + duration)
                solver.Add(selected <= before + after)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromSeconds(seconds)
    solution = routing.SolveWithParameters(params)
    if not solution:
        return {'feasible': False, 'routes': [], 'message':
                'Chưa tìm được phương án hợp lệ trong thời gian tìm kiếm. Kiểm tra tải xe, thể tích, giờ mở cửa, giờ cấm hoặc thêm xe.',
                'solverStatus': routing.status()}
    routes, served = [], set()
    for v, vehicle in enumerate(req.vehicles):
        i, distance, stops = routing.Start(v), 0, []
        while not routing.IsEnd(i):
            node = manager.IndexToNode(i)
            if 1 <= node < n - 1:
                s = stations[node - 1]
                served.add(s.id)
                stops.append({**s.model_dump(), 'cls': classes[node - 1],
                              'etaMin': solution.Value(time.CumulVar(i)), 'status': 'pending'})
            j = solution.Value(routing.NextVar(i))
            distance += meters(i, j)
            i = j
        if not stops:
            continue
        routes.append({'vehicle': vehicle.model_dump(), 'stops': stops,
                       'distanceKm': round(distance / 1000, 3),
                       'endMin': solution.Value(time.CumulVar(i)),
                       'loadKg': round(sum(s['massKg'] for s in stops), 3),
                       'volumeM3': round(sum(s['volumeM3'] for s in stops), 3), 'status': 'assigned'})
    return {'feasible': True, 'routes': routes, 'provider': req.provider,
            'depot': req.depot.model_dump(), 'destination': req.destination.model_dump(),
            'unserved': [s.id for s in stations if s.id not in served],
            'message': 'Phương án khả thi từ OR-Tools; không bảo đảm tối ưu toàn cục.',
            'solverStatus': routing.status()}
