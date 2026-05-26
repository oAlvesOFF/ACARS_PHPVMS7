<?php

use Illuminate\Support\Facades\Route;
use Modules\CloudeAcars\Http\Controllers\Admin\AdminController;

Route::group([
    'prefix' => 'admin/cloudeacars',
    'middleware' => ['web', 'auth', 'ability:admin,admin-access'],
], function () {
    Route::get('/', [AdminController::class, 'index'])->name('cloudeacars.admin.index');
});
