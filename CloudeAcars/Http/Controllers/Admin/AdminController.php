<?php

namespace Modules\CloudeAcars\Http\Controllers\Admin;

use App\Contracts\Controller;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function index(Request $request)
    {
        return view('cloudeacars::index');
    }
}
