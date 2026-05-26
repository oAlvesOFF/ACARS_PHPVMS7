<?php

namespace Modules\CloudeAcars\Models;

use App\Models\Model;

class Config extends Model
{
    protected $table = 'cloudeacars_config';
    protected $fillable = ['key', 'value'];
}
