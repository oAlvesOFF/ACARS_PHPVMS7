<?php

namespace Modules\CloudeAcars\Http\Controllers\Api;

use App\Contracts\Controller;
use Illuminate\Http\Request;
use Modules\CloudeAcars\Services\CloudeAcarsService;

class ApiController extends Controller
{
    protected $acarsService;

    public function __construct(CloudeAcarsService $acarsService)
    {
        $this->acarsService = $acarsService;
    }

    public function config(Request $request)
    {
        return response()->json([
            'success' => true,
            'config' => []
        ]);
    }

    public function version(Request $request)
    {
        return response()->json([
            'success' => true,
            'version' => '0.5.51'
        ]);
    }

    public function heartbeat(Request $request)
    {
        return response()->json([
            'success' => true
        ]);
    }

    public function pirepLanding(Request $request, $id)
    {
        return response()->json([
            'success' => true
        ]);
    }

    public function missingRunwayData(Request $request)
    {
        return response()->json([
            'success' => true
        ]);
    }
}
