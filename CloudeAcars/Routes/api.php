<?php

use Illuminate\Support\Facades\Route;
use Modules\CloudeAcars\Http\Controllers\Api\ApiController;

Route::group([
    'prefix' => 'cloudeacars',
    'middleware' => ['api'],
], function () {

    Route::get('/version', [ApiController::class, 'version']);

    Route::group(['middleware' => ['api.auth']], function () {
        Route::get('/config', [ApiController::class, 'config']);
        Route::post('/heartbeat', [ApiController::class, 'heartbeat']);
        Route::post('/pirep/{id}/landing', [ApiController::class, 'pirepLanding']);
        Route::post('/runway-data/missing', [ApiController::class, 'missingRunwayData']);
    });
});
