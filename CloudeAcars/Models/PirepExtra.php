<?php

namespace Modules\CloudeAcars\Models;

use App\Models\Model;

class PirepExtra extends Model
{
    protected $table = 'cloudeacars_pirep_extra';
    protected $fillable = ['pirep_id', 'landing_fpm', 'touchdown_g', 'landing_lat', 'landing_lon'];
}
